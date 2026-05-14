Here you go—first the production-ready `app.js`, then a ready-to-import Postman collection JSON.

---

## 1) Production-Ready `app.js` (Node.js + Express)

This assumes:

* You are using:

  * `express`
  * `mongoose`
  * `cors`
  * `helmet`
  * `morgan`
  * `dotenv`
* You already created:

  * `./routes/whatsapp.routes.js` (for webhook GET/POST)
  * `./services/whatsapp.service.js` (for sending messages)

```javascript
// src/app.js
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import whatsappRoutes from "./routes/whatsapp.routes.js";
import { sendMessage } from "./services/whatsapp.service.js";

dotenv.config();

const app = express();

// ---------- Core Middleware ----------
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("combined"));

// ---------- MongoDB Connection ----------
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not defined in environment variables.");
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI, {
    autoIndex: true
  })
  .then(() => {
    console.log("✅ Connected to MongoDB");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

// ---------- Health Check ----------
app.get("/health", (req, res) => {
  return res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ---------- WhatsApp Webhook Routes ----------
// Routes expected:
//   GET  /whatsapp/webhook   -> verifyWebhook
//   POST /whatsapp/webhook   -> receiveWebhook
app.use("/whatsapp", whatsappRoutes);

// ---------- Send Message API ----------
// This is what your React app or Postman will call.
app.post("/api/send-message", async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({
        error: "Missing required fields: 'to' and 'message'"
      });
    }

    await sendMessage(to, message);

    return res.status(200).json({
      success: true,
      to,
      message
    });
  } catch (error) {
    console.error("Error sending WhatsApp message:", error.response?.data || error.message);

    return res.status(500).json({
      error: "Failed to send WhatsApp message",
      details: error.response?.data || error.message
    });
  }
});

// ---------- 404 Fallback ----------
app.use((req, res) => {
  return res.status(404).json({
    error: "Route not found"
  });
});

// ---------- Global Error Handler ----------
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  return res.status(500).json({
    error: "Internal server error"
  });
});

export default app;
```

Example `index.js` (entrypoint) for completeness:

```javascript
// index.js
import app from "./src/app.js";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
```

Required environment variables:

```bash
MONGODB_URI=mongodb+srv://...
PORT=4000
WHATSAPP_TOKEN=EAAG...
PHONE_NUMBER_ID=1234567890
VERIFY_TOKEN=some-random-string
```

---

## 4) Postman Collection (Ready to Import)

This covers:

1. Health check
2. Send WhatsApp message (via your backend)
3. Webhook verification (GET)
4. Webhook receiver (POST test)

Copy–paste this JSON into Postman → “Import” → “Raw text”.

```json
{
  "info": {
    "name": "MERN WhatsApp Cloud API",
    "_postman_id": "a3d5b7e0-1234-4567-89ab-whatsapp-mern-collection",
    "description": "Postman collection for testing MERN backend integrated with WhatsApp Cloud API (Meta).",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}/health",
          "host": [
            "{{base_url}}"
          ],
          "path": [
            "health"
          ]
        }
      },
      "response": []
    },
    {
      "name": "Send WhatsApp Message (via Backend)",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"to\": \"{{test_phone_number}}\",\n  \"message\": \"Hello from the MERN backend via Postman!\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/api/send-message",
          "host": [
            "{{base_url}}"
          ],
          "path": [
            "api",
            "send-message"
          ]
        }
      },
      "response": []
    },
    {
      "name": "Verify Webhook (GET - Meta Setup)",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}/whatsapp/webhook?hub.mode=subscribe&hub.verify_token={{verify_token}}&hub.challenge=123456",
          "host": [
            "{{base_url}}"
          ],
          "path": [
            "whatsapp",
            "webhook"
          ],
          "query": [
            {
              "key": "hub.mode",
              "value": "subscribe"
            },
            {
              "key": "hub.verify_token",
              "value": "{{verify_token}}"
            },
            {
              "key": "hub.challenge",
              "value": "123456"
            }
          ]
        }
      },
      "response": []
    },
    {
      "name": "Receive Webhook (POST - Test Payload)",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"object\": \"whatsapp_business_account\",\n  \"entry\": [\n    {\n      \"id\": \"WHATSAPP_BUSINESS_ACCOUNT_ID\",\n      \"changes\": [\n        {\n          \"value\": {\n            \"messaging_product\": \"whatsapp\",\n            \"metadata\": {\n              \"display_phone_number\": \"1234567890\",\n              \"phone_number_id\": \"{{phone_number_id}}\"\n            },\n            \"contacts\": [\n              {\n                \"profile\": {\n                  \"name\": \"Test User\"\n                },\n                \"wa_id\": \"{{test_phone_number}}\"\n              }\n            ],\n            \"messages\": [\n              {\n                \"from\": \"{{test_phone_number}}\",\n                \"id\": \"wamid.TEST_MESSAGE_ID\",\n                \"timestamp\": \"1700000000\",\n                \"text\": {\n                  \"body\": \"Hello backend\"\n                },\n                \"type\": \"text\"\n              }\n            ]\n          },\n          \"field\": \"messages\"\n        }\n      ]\n    }\n  ]\n}\n"
        },
        "url": {
          "raw": "{{base_url}}/whatsapp/webhook",
          "host": [
            "{{base_url}}"
          ],
          "path": [
            "whatsapp",
            "webhook"
          ]
        }
      },
      "response": []
    }
  ],
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:4000"
    },
    {
      "key": "phone_number_id",
      "value": "YOUR_PHONE_NUMBER_ID"
    },
    {
      "key": "verify_token",
      "value": "some-random-string"
    },
    {
      "key": "test_phone_number",
      "value": "911234567890"
    }
  ]
}
```

---

If you want, next step I can:

* Align this to Fastify instead of Express if your stack is already standardized on Fastify, and/or
* Add a simple conversation logging model + usage pattern so every inbound/outbound WhatsApp message is persisted cleanly in MongoDB.






---
---







Here is the **production-ready `app.js` rewritten entirely for Fastify**, engineered for a MERN backend integrated with WhatsApp Cloud API.
This version is optimized for performance, security, and enterprise ops readiness.

---

# Production-Grade `app.js` (Fastify Version)

**Key Capabilities Included:**

* Fastify server bootstrap
* CORS, Helmet-equivalent security hardening
* MongoDB connection
* WhatsApp webhook GET/POST routes
* Unified `/api/send-message` endpoint
* Global error handling
* Health check route

---

## `src/app.js` (Fastify)

```javascript
// src/app.js
import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyFormbody from "@fastify/formbody";
import dotenv from "dotenv";
import mongoose from "mongoose";
import whatsappRoutes from "./routes/whatsapp.routes.js";
import { sendMessage } from "./services/whatsapp.service.js";

dotenv.config();

export const buildApp = async () => {
  const fastify = Fastify({
    logger: true,
    trustProxy: true
  });

  // ---------- Security & Middleware ----------
  await fastify.register(fastifyHelmet);
  await fastify.register(fastifyCors, { origin: "*" });
  await fastify.register(fastifyFormbody);

  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    function (req, body, done) {
      try {
        const json = body ? JSON.parse(body) : {};
        done(null, json);
      } catch (err) {
        err.statusCode = 400;
        done(err, undefined);
      }
    }
  );

  // ---------- MongoDB Connection ----------
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    fastify.log.error("MONGODB_URI is not defined.");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI, { autoIndex: true });
    fastify.log.info("Connected to MongoDB");
  } catch (err) {
    fastify.log.error("MongoDB connection error: " + err.message);
    process.exit(1);
  }

  // ---------- Health Check ----------
  fastify.get("/health", async () => {
    return {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  });

  // ---------- WhatsApp Routes ----------
  fastify.register(whatsappRoutes, { prefix: "/whatsapp" });

  // ---------- Send WhatsApp Message ----------
  fastify.post("/api/send-message", async (req, reply) => {
    try {
      const { to, message } = req.body;

      if (!to || !message) {
        return reply.status(400).send({
          error: "Missing required fields: 'to' and 'message'"
        });
      }

      await sendMessage(to, message);

      return reply.status(200).send({
        success: true,
        to,
        message
      });
    } catch (err) {
      fastify.log.error(err);

      return reply.status(500).send({
        error: "Failed to send WhatsApp message",
        details: err.response?.data || err.message
      });
    }
  });

  // ---------- 404 Fallback ----------
  fastify.setNotFoundHandler((req, reply) => {
    reply.status(404).send({ error: "Route not found" });
  });

  // ---------- Global Error Handler ----------
  fastify.setErrorHandler((err, req, reply) => {
    fastify.log.error("Unhandled error:", err);

    reply.status(500).send({
      error: "Internal server error"
    });
  });

  return fastify;
};
```

---

## Example `index.js` (Server Entrypoint)

```javascript
// index.js
import { buildApp } from "./src/app.js";
import dotenv from "dotenv";

dotenv.config();

const startServer = async () => {
  const fastify = await buildApp();

  const PORT = process.env.PORT || 4000;

  try {
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    fastify.log.info(`Server running on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

startServer();
```

---

# Summary of What You Now Have

Your Fastify backend now supports:

* WhatsApp Cloud API message sending
* Webhook reception and verification
* MongoDB integration
* Full MERN-ready backend foundation
* Ready for deployment on AWS/GCP/DigitalOcean/Vercel

---

If you want, I can also deliver:

* A Fastify plugin version of your WhatsApp routes
* A complete message logging system (Mongo schemas + handlers)
* A production CI/CD workflow for EC2, Docker, or Kubernetes
* A ready-made chatbot workflow engine for WhatsApp

Tell me what you want next.
