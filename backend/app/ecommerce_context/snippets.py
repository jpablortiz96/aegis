from typing import Optional

SNIPPETS = {
    "checkout/handler.js": {
        "filename": "checkout/handler.js",
        "description": "Main checkout handler for cart-to-order conversion",
        "categories": ["checkout"],
        "code": """\
import { validateCart } from "./cartValidator";
import { reserveInventory } from "../inventory/stock";
import { processPayment } from "../payments/stripe";
import { createOrder } from "../orders/processor";
import { sendConfirmation } from "../notifications/email";

export async function handleCheckout(cartId, userId, paymentMethod) {
  const cart = await validateCart(cartId, userId);
  if (!cart.valid) {
    throw new Error(`Cart validation failed: ${cart.reason}`);
  }

  // Reserve inventory before charging
  const reservation = await reserveInventory(cart.items);
  if (!reservation.success) {
    throw new Error(`Inventory reservation failed for items: ${reservation.failedItems.join(", ")}`);
  }

  let paymentResult;
  try {
    paymentResult = await processPayment({
      amount: cart.total,
      currency: cart.currency,
      method: paymentMethod,
      metadata: { cartId, userId },
    });
  } catch (paymentError) {
    // Rollback inventory reservation on payment failure
    await reserveInventory(cart.items, { release: true });
    throw paymentError;
  }

  const order = await createOrder({
    cartId,
    userId,
    paymentId: paymentResult.id,
    items: cart.items,
    total: cart.total,
  });

  // WARNING: sendConfirmation is fire-and-forget; errors here are swallowed
  sendConfirmation(userId, order.id).catch(console.error);

  return { orderId: order.id, status: "confirmed" };
}
""",
    },
    "payments/stripe.js": {
        "filename": "payments/stripe.js",
        "description": "Stripe payment gateway integration",
        "categories": ["payment"],
        "code": """\
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

const MAX_RETRIES = 3;

export async function processPayment({ amount, currency, method, metadata }) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const intent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        payment_method: method.token,
        confirm: true,
        metadata,
        return_url: process.env.STRIPE_RETURN_URL,
      });

      if (intent.status === "succeeded") {
        return { id: intent.id, status: "succeeded", amount: intent.amount };
      } else if (intent.status === "requires_action") {
        throw new Error("3D Secure authentication required");
      }
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      // Exponential backoff — NOTE: does not handle idempotency keys
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
  }
}

export async function refundPayment(paymentIntentId, amount) {
  return stripe.refunds.create({ payment_intent: paymentIntentId, amount });
}
""",
    },
    "inventory/stock.js": {
        "filename": "inventory/stock.js",
        "description": "Inventory stock management and reservation logic",
        "categories": ["inventory", "checkout"],
        "code": """\
import { db } from "../db";

export async function reserveInventory(items, options = {}) {
  const { release = false } = options;
  const failedItems = [];

  await db.transaction(async (trx) => {
    for (const item of items) {
      const product = await trx("products")
        .where({ id: item.productId, variant_id: item.variantId })
        .forUpdate()
        .first();

      if (!product) {
        failedItems.push(item.productId);
        continue;
      }

      const newStock = release
        ? product.reserved_quantity - item.quantity
        : product.reserved_quantity + item.quantity;

      if (!release && product.available_quantity < item.quantity) {
        failedItems.push(item.productId);
        continue;
      }

      await trx("products").where({ id: item.productId }).update({
        reserved_quantity: Math.max(0, newStock),
        updated_at: new Date(),
      });
    }
  });

  return { success: failedItems.length === 0, failedItems };
}

export async function getStockLevel(productId, variantId) {
  const product = await db("products").where({ id: productId, variant_id: variantId }).first();
  if (!product) return null;
  return {
    available: product.available_quantity - product.reserved_quantity,
    total: product.available_quantity,
    reserved: product.reserved_quantity,
  };
}
""",
    },
    "auth/login.js": {
        "filename": "auth/login.js",
        "description": "User authentication and session management",
        "categories": ["authentication"],
        "code": """\
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { rateLimiter } from "../middleware/rateLimiter";

const TOKEN_EXPIRY = "24h";
const MAX_LOGIN_ATTEMPTS = 5;

export async function loginUser(email, password, ipAddress) {
  // Rate limit by IP
  const limited = await rateLimiter.check(`login:${ipAddress}`, MAX_LOGIN_ATTEMPTS, 900);
  if (limited) {
    throw new Error("Too many login attempts. Try again in 15 minutes.");
  }

  const user = await db("users").where({ email: email.toLowerCase() }).first();

  if (!user) {
    // Timing-safe: still run bcrypt to prevent user enumeration
    await bcrypt.compare(password, "$2a$12$invalidhashtopreventtiming");
    throw new Error("Invalid credentials");
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw new Error("Account locked. Contact support.");
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    await db("users").where({ id: user.id }).increment("failed_attempts", 1);
    throw new Error("Invalid credentials");
  }

  // Reset failed attempts on success
  await db("users").where({ id: user.id }).update({
    failed_attempts: 0,
    last_login_at: new Date(),
    last_login_ip: ipAddress,
  });

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  return { token, userId: user.id, role: user.role };
}
""",
    },
    "orders/processor.js": {
        "filename": "orders/processor.js",
        "description": "Order creation and post-checkout processing pipeline",
        "categories": ["checkout", "payment"],
        "code": """\
import { db } from "../db";
import { publishEvent } from "../events/publisher";
import { generateInvoice } from "../billing/invoice";

export async function createOrder({ cartId, userId, paymentId, items, total }) {
  return await db.transaction(async (trx) => {
    const [orderId] = await trx("orders").insert({
      cart_id: cartId,
      user_id: userId,
      payment_id: paymentId,
      total_amount: total,
      status: "pending",
      created_at: new Date(),
    });

    const orderItems = items.map((item) => ({
      order_id: orderId,
      product_id: item.productId,
      variant_id: item.variantId,
      quantity: item.quantity,
      unit_price: item.price,
      subtotal: item.price * item.quantity,
    }));

    await trx("order_items").insert(orderItems);

    await trx("orders").where({ id: orderId }).update({ status: "confirmed" });

    // Publish domain event for downstream consumers (fulfillment, analytics)
    await publishEvent("order.created", {
      orderId,
      userId,
      total,
      itemCount: items.length,
    });

    // Invoice generation is async — could fail silently
    generateInvoice(orderId).catch((err) => {
      console.error(`Invoice generation failed for order ${orderId}:`, err);
    });

    return { id: orderId, status: "confirmed" };
  });
}

export async function cancelOrder(orderId, reason) {
  await db("orders").where({ id: orderId }).update({
    status: "cancelled",
    cancellation_reason: reason,
    cancelled_at: new Date(),
  });
  await publishEvent("order.cancelled", { orderId, reason });
}
""",
    },
}

CATEGORY_MAP = {
    "checkout": ["checkout/handler.js", "inventory/stock.js", "orders/processor.js"],
    "payment": ["payments/stripe.js", "orders/processor.js"],
    "inventory": ["inventory/stock.js"],
    "authentication": ["auth/login.js"],
    "ui": [],
    "performance": ["checkout/handler.js", "inventory/stock.js"],
    "other": list(SNIPPETS.keys()),
}


def get_relevant_context(category: str) -> list:
    """Return list of relevant code snippets for the given incident category."""
    filenames = CATEGORY_MAP.get(category.lower(), list(SNIPPETS.keys()))
    return [SNIPPETS[f] for f in filenames if f in SNIPPETS]
