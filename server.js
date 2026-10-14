const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const Product = require("./Product");

const app = express();
app.use(express.json());
app.get("/", (req, res) => {
    res.send("Inventory Management System is Running!");
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log(err));

// 1. Add a product
app.post("/products", async (req, res, next) => {
    try {
        const product = await Product.create(req.body);
        res.status(201).json(product);
    } catch (err) {
        next(err);
    }
});

// 2. Get all products with filtering, sorting and pagination
app.get("/products", async (req, res, next) => {
    try {
        const filter = {};

        if (req.query.category) {
            filter.category = req.query.category;
        }

        if (req.query.search) {
            filter.name = {
                $regex: req.query.search,
                $options: "i"
            };
        }

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));

        const products = await Product.find(filter)
            .sort({ price: req.query.sort === "desc" ? -1 : 1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json(products);
    } catch (err) {
        next(err);
    }
});

// 3. Get one product by ID
app.get("/products/:id", async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.json(product);
    } catch (err) {
        next(err);
    }
});

// 4. Update product details
app.put("/products/:id", async (req, res, next) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.json(product);
    } catch (err) {
        next(err);
    }
});

// 5. Delete a product
app.delete("/products/:id", async (req, res, next) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.json({ message: "Product deleted successfully" });
    } catch (err) {
        next(err);
    }
});

// 6. Restock or sell products
app.patch("/products/:id/stock", async (req, res, next) => {
    try {
        const { action, quantity } = req.body;

        if (!Number.isInteger(quantity) || quantity <= 0) {
            return res.status(400).json({
                message: "Quantity must be a positive integer"
            });
        }

        if (!["restock", "sale"].includes(action)) {
            return res.status(400).json({
                message: "Action must be restock or sale"
            });
        }

        const change = action === "restock" ? quantity : -quantity;

        const product = await Product.findOneAndUpdate(
            {
                _id: req.params.id,
                ...(action === "sale"
                    ? { quantity: { $gte: quantity } }
                    : {})
            },
            { $inc: { quantity: change } },
            { new: true, runValidators: true }
        );

        if (!product) {
            return res.status(400).json({
                message: "Product not found or insufficient stock"
            });
        }

        res.json(product);
    } catch (err) {
        next(err);
    }
});

// 7. Low-stock report
app.get("/reports/low-stock", async (req, res, next) => {
    try {
        const products = await Product.find({
            quantity: { $lt: 10 }
        });

        res.json(products);
    } catch (err) {
        next(err);
    }
});

// 8. Category-wise inventory summary
app.get("/reports/categories", async (req, res, next) => {
    try {
        const report = await Product.aggregate([
            {
                $group: {
                    _id: "$category",
                    totalProducts: { $sum: 1 },
                    totalStock: { $sum: "$quantity" },
                    totalValue: {
                        $sum: { $multiply: ["$price", "$quantity"] }
                    }
                }
            }
        ]);

        res.json(report);
    } catch (err) {
        next(err);
    }
});

// Error handling
app.use((err, req, res, next) => {
    if (err.name === "CastError") {
        return res.status(400).json({ message: "Invalid product ID" });
    }

    if (err.name === "ValidationError") {
        return res.status(400).json({ message: err.message });
    }

    res.status(500).json({ message: "Server error" });
});

// Start server
app.listen(process.env.PORT || 3000, () => {
    console.log("Server running on port 3000");
});