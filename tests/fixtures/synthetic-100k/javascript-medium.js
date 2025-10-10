/**
 * Large JavaScript file for performance benchmarking
 * Target: ~30,000 AST nodes
 * This file contains realistic JavaScript patterns including ES6+ features,
 * async/await, classes, object destructuring, and complex data structures.
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */
const EventEmitter = require("events");
const fs = require("fs");
const util = require("util");

// Data models and validation
class ValidationError extends Error {
  constructor(message, field, value) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
    this.value = value;
  }
}

class Validator {
  static validateEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(email)) {
      throw new ValidationError("Invalid email format", "email", email);
    }
    return true;
  }

  static validateUsername(username) {
    if (typeof username !== "string") {
      throw new ValidationError(
        "Username must be a string",
        "username",
        username,
      );
    }
    if (username.length < 3 || username.length > 20) {
      throw new ValidationError(
        "Username must be 3-20 characters",
        "username",
        username,
      );
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      throw new ValidationError(
        "Username must be alphanumeric",
        "username",
        username,
      );
    }
    return true;
  }

  static validatePassword(password) {
    if (typeof password !== "string") {
      throw new ValidationError(
        "Password must be a string",
        "password",
        password,
      );
    }
    if (password.length < 8) {
      throw new ValidationError(
        "Password must be at least 8 characters",
        "password",
        password,
      );
    }
    if (!/[A-Z]/.test(password)) {
      throw new ValidationError(
        "Password must contain uppercase letter",
        "password",
        password,
      );
    }
    if (!/[a-z]/.test(password)) {
      throw new ValidationError(
        "Password must contain lowercase letter",
        "password",
        password,
      );
    }
    if (!/[0-9]/.test(password)) {
      throw new ValidationError(
        "Password must contain number",
        "password",
        password,
      );
    }
    return true;
  }

  static validateDate(date) {
    if (!(date instanceof Date)) {
      throw new ValidationError("Invalid date object", "date", date);
    }
    if (isNaN(date.getTime())) {
      throw new ValidationError("Invalid date value", "date", date);
    }
    return true;
  }

  static validateUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      throw new ValidationError("Invalid URL format", "url", url);
    }
  }

  static validatePhoneNumber(phone) {
    const regex = /^\+?[1-9]\d{1,14}$/;
    if (!regex.test(phone)) {
      throw new ValidationError("Invalid phone number", "phone", phone);
    }
    return true;
  }

  static validateRequired(value, field) {
    if (value === null || value === undefined || value === "") {
      throw new ValidationError(`${field} is required`, field, value);
    }
    return true;
  }

  static validateLength(value, min, max, field) {
    if (value.length < min || value.length > max) {
      throw new ValidationError(
        `${field} must be between ${min} and ${max} characters`,
        field,
        value,
      );
    }
    return true;
  }

  static validateRange(value, min, max, field) {
    if (value < min || value > max) {
      throw new ValidationError(
        `${field} must be between ${min} and ${max}`,
        field,
        value,
      );
    }
    return true;
  }

  static validateEnum(value, allowed, field) {
    if (!allowed.includes(value)) {
      throw new ValidationError(
        `${field} must be one of: ${allowed.join(", ")}`,
        field,
        value,
      );
    }
    return true;
  }
}

// Database abstraction layer
class Database {
  constructor(config) {
    this.config = config;
    this.tables = new Map();
    this.indexes = new Map();
    this.connected = false;
  }

  async connect() {
    if (this.connected) {
      return;
    }
    // Simulate connection delay
    await new Promise((resolve) => setTimeout(resolve, 100));
    this.connected = true;
  }

  async disconnect() {
    if (!this.connected) {
      return;
    }
    this.tables.clear();
    this.indexes.clear();
    this.connected = false;
  }

  createTable(name, schema) {
    if (this.tables.has(name)) {
      throw new Error(`Table ${name} already exists`);
    }
    this.tables.set(name, {
      name,
      schema,
      rows: [],
    });
  }

  dropTable(name) {
    if (!this.tables.has(name)) {
      throw new Error(`Table ${name} does not exist`);
    }
    this.tables.delete(name);
    // Remove related indexes
    for (const [key, index] of this.indexes.entries()) {
      if (index.table === name) {
        this.indexes.delete(key);
      }
    }
  }

  createIndex(table, field, unique = false) {
    const key = `${table}.${field}`;
    if (this.indexes.has(key)) {
      throw new Error(`Index ${key} already exists`);
    }
    this.indexes.set(key, {
      table,
      field,
      unique,
      values: new Map(),
    });
  }

  async insert(table, data) {
    const tableData = this.tables.get(table);
    if (!tableData) {
      throw new Error(`Table ${table} does not exist`);
    }

    const row = { ...data, _id: this.generateId() };
    tableData.rows.push(row);

    // Update indexes
    for (const [key, index] of this.indexes.entries()) {
      if (index.table === table) {
        const value = row[index.field];
        if (value !== undefined) {
          if (index.unique && index.values.has(value)) {
            throw new Error(`Duplicate value for unique index ${key}`);
          }
          if (!index.values.has(value)) {
            index.values.set(value, []);
          }
          index.values.get(value).push(row._id);
        }
      }
    }

    return row;
  }

  async findById(table, id) {
    const tableData = this.tables.get(table);
    if (!tableData) {
      throw new Error(`Table ${table} does not exist`);
    }

    return tableData.rows.find((row) => row._id === id) || null;
  }

  async findOne(table, query) {
    const tableData = this.tables.get(table);
    if (!tableData) {
      throw new Error(`Table ${table} does not exist`);
    }

    return tableData.rows.find((row) => this.matchesQuery(row, query)) || null;
  }

  async findMany(table, query = {}, options = {}) {
    const tableData = this.tables.get(table);
    if (!tableData) {
      throw new Error(`Table ${table} does not exist`);
    }

    let results = tableData.rows.filter((row) => this.matchesQuery(row, query));

    if (options.sort) {
      results = this.sortResults(results, options.sort);
    }

    if (options.skip) {
      results = results.slice(options.skip);
    }

    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async update(table, query, updates) {
    const tableData = this.tables.get(table);
    if (!tableData) {
      throw new Error(`Table ${table} does not exist`);
    }

    const rows = tableData.rows.filter((row) => this.matchesQuery(row, query));

    for (const row of rows) {
      Object.assign(row, updates);
    }

    return rows.length;
  }

  async delete(table, query) {
    const tableData = this.tables.get(table);
    if (!tableData) {
      throw new Error(`Table ${table} does not exist`);
    }

    const beforeLength = tableData.rows.length;
    tableData.rows = tableData.rows.filter(
      (row) => !this.matchesQuery(row, query),
    );

    return beforeLength - tableData.rows.length;
  }

  async count(table, query = {}) {
    const tableData = this.tables.get(table);
    if (!tableData) {
      throw new Error(`Table ${table} does not exist`);
    }

    return tableData.rows.filter((row) => this.matchesQuery(row, query)).length;
  }

  matchesQuery(row, query) {
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === "object" && value !== null) {
        // Handle operators like $gt, $lt, etc.
        if (value.$eq !== undefined && row[key] !== value.$eq) {
          return false;
        }
        if (value.$ne !== undefined && row[key] === value.$ne) {
          return false;
        }
        if (value.$gt !== undefined && row[key] <= value.$gt) {
          return false;
        }
        if (value.$gte !== undefined && row[key] < value.$gte) {
          return false;
        }
        if (value.$lt !== undefined && row[key] >= value.$lt) {
          return false;
        }
        if (value.$lte !== undefined && row[key] > value.$lte) {
          return false;
        }
        if (value.$in !== undefined && !value.$in.includes(row[key])) {
          return false;
        }
        if (value.$nin !== undefined && value.$nin.includes(row[key])) {
          return false;
        }
      } else {
        if (row[key] !== value) {
          return false;
        }
      }
    }
    return true;
  }

  sortResults(results, sort) {
    const entries = Object.entries(sort);

    return results.sort((a, b) => {
      for (const [field, direction] of entries) {
        const aVal = a[field];
        const bVal = b[field];

        if (aVal < bVal) {
          return direction === 1 ? -1 : 1;
        }
        if (aVal > bVal) {
          return direction === 1 ? 1 : -1;
        }
      }
      return 0;
    });
  }

  generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Service layer
class UserService extends EventEmitter {
  constructor(database) {
    super();
    this.db = database;
    this.tableName = "users";
  }

  async initialize() {
    this.db.createTable(this.tableName, {
      id: "string",
      username: "string",
      email: "string",
      password: "string",
      firstName: "string",
      lastName: "string",
      dateOfBirth: "date",
      role: "string",
      status: "string",
      createdAt: "date",
      updatedAt: "date",
    });

    this.db.createIndex(this.tableName, "username", true);
    this.db.createIndex(this.tableName, "email", true);
  }

  async createUser(data) {
    // Validate required fields
    Validator.validateRequired(data.username, "username");
    Validator.validateRequired(data.email, "email");
    Validator.validateRequired(data.password, "password");
    Validator.validateRequired(data.firstName, "firstName");
    Validator.validateRequired(data.lastName, "lastName");

    // Validate field formats
    Validator.validateUsername(data.username);
    Validator.validateEmail(data.email);
    Validator.validatePassword(data.password);

    if (data.dateOfBirth) {
      Validator.validateDate(data.dateOfBirth);
    }

    // Check for existing user
    const existingByUsername = await this.db.findOne(this.tableName, {
      username: data.username,
    });
    if (existingByUsername) {
      throw new Error("Username already exists");
    }

    const existingByEmail = await this.db.findOne(this.tableName, {
      email: data.email,
    });
    if (existingByEmail) {
      throw new Error("Email already exists");
    }

    // Hash password (simulated)
    const hashedPassword = await this.hashPassword(data.password);

    // Create user
    const user = await this.db.insert(this.tableName, {
      username: data.username,
      email: data.email,
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth || null,
      role: data.role || "user",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    this.emit("userCreated", userWithoutPassword);
    return userWithoutPassword;
  }

  async getUserById(id) {
    const user = await this.db.findById(this.tableName, id);
    if (!user) {
      return null;
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async getUserByUsername(username) {
    const user = await this.db.findOne(this.tableName, { username });
    if (!user) {
      return null;
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async getUserByEmail(email) {
    const user = await this.db.findOne(this.tableName, { email });
    if (!user) {
      return null;
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateUser(id, updates) {
    const user = await this.db.findById(this.tableName, id);
    if (!user) {
      throw new Error("User not found");
    }

    // Validate updates
    if (updates.username) {
      Validator.validateUsername(updates.username);
      const existing = await this.db.findOne(this.tableName, {
        username: updates.username,
      });
      if (existing && existing._id !== id) {
        throw new Error("Username already exists");
      }
    }

    if (updates.email) {
      Validator.validateEmail(updates.email);
      const existing = await this.db.findOne(this.tableName, {
        email: updates.email,
      });
      if (existing && existing._id !== id) {
        throw new Error("Email already exists");
      }
    }

    if (updates.password) {
      Validator.validatePassword(updates.password);
      updates.password = await this.hashPassword(updates.password);
    }

    // Update user
    await this.db.update(
      this.tableName,
      { _id: id },
      { ...updates, updatedAt: new Date() },
    );

    const updatedUser = await this.getUserById(id);
    this.emit("userUpdated", updatedUser);
    return updatedUser;
  }

  async deleteUser(id) {
    const user = await this.db.findById(this.tableName, id);
    if (!user) {
      throw new Error("User not found");
    }

    await this.db.delete(this.tableName, { _id: id });
    this.emit("userDeleted", { id });
    return true;
  }

  async listUsers(options = {}) {
    const query = {};

    if (options.role) {
      query.role = options.role;
    }

    if (options.status) {
      query.status = options.status;
    }

    const users = await this.db.findMany(this.tableName, query, {
      sort: options.sortBy
        ? { [options.sortBy]: options.sortOrder || 1 }
        : undefined,
      skip: options.offset,
      limit: options.limit,
    });

    return users.map(({ password, ...user }) => user);
  }

  async searchUsers(searchTerm) {
    const allUsers = await this.db.findMany(this.tableName);
    const lowerSearch = searchTerm.toLowerCase();

    const results = allUsers.filter((user) => {
      return (
        user.username.toLowerCase().includes(lowerSearch) ||
        user.email.toLowerCase().includes(lowerSearch) ||
        user.firstName.toLowerCase().includes(lowerSearch) ||
        user.lastName.toLowerCase().includes(lowerSearch)
      );
    });

    return results.map(({ password, ...user }) => user);
  }

  async countUsers(filters = {}) {
    const query = {};

    if (filters.role) {
      query.role = filters.role;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    return this.db.count(this.tableName, query);
  }

  async authenticateUser(username, password) {
    const user = await this.db.findOne(this.tableName, {
      username,
    });

    if (!user) {
      throw new Error("Invalid credentials");
    }

    const isValid = await this.verifyPassword(password, user.password);
    if (!isValid) {
      throw new Error("Invalid credentials");
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async changePassword(id, oldPassword, newPassword) {
    const user = await this.db.findById(this.tableName, id);
    if (!user) {
      throw new Error("User not found");
    }

    const isValid = await this.verifyPassword(oldPassword, user.password);
    if (!isValid) {
      throw new Error("Invalid current password");
    }

    Validator.validatePassword(newPassword);
    const hashedPassword = await this.hashPassword(newPassword);

    await this.db.update(
      this.tableName,
      { _id: id },
      { password: hashedPassword, updatedAt: new Date() },
    );

    this.emit("passwordChanged", { id });
    return true;
  }

  async hashPassword(password) {
    // Simulated hashing (would use bcrypt in production)
    return `hashed_${password}`;
  }

  async verifyPassword(password, hash) {
    // Simulated verification (would use bcrypt in production)
    return hash === `hashed_${password}`;
  }

  async getUserStats() {
    const total = await this.countUsers();
    const activeUsers = await this.countUsers({ status: "active" });
    const inactiveUsers = await this.countUsers({ status: "inactive" });
    const adminUsers = await this.countUsers({ role: "admin" });
    const regularUsers = await this.countUsers({ role: "user" });

    return {
      total,
      byStatus: {
        active: activeUsers,
        inactive: inactiveUsers,
      },
      byRole: {
        admin: adminUsers,
        user: regularUsers,
      },
    };
  }
}

// Product service
class ProductService extends EventEmitter {
  constructor(database) {
    super();
    this.db = database;
    this.tableName = "products";
  }

  async initialize() {
    this.db.createTable(this.tableName, {
      id: "string",
      name: "string",
      description: "string",
      price: "number",
      currency: "string",
      category: "string",
      tags: "array",
      stock: "number",
      images: "array",
      status: "string",
      createdAt: "date",
      updatedAt: "date",
    });

    this.db.createIndex(this.tableName, "category");
    this.db.createIndex(this.tableName, "status");
  }

  async createProduct(data) {
    Validator.validateRequired(data.name, "name");
    Validator.validateRequired(data.price, "price");
    Validator.validateRequired(data.category, "category");

    if (data.price < 0) {
      throw new ValidationError("Price must be positive", "price", data.price);
    }

    if (data.stock !== undefined && data.stock < 0) {
      throw new ValidationError(
        "Stock must be non-negative",
        "stock",
        data.stock,
      );
    }

    const product = await this.db.insert(this.tableName, {
      name: data.name,
      description: data.description || "",
      price: data.price,
      currency: data.currency || "USD",
      category: data.category,
      tags: data.tags || [],
      stock: data.stock || 0,
      images: data.images || [],
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.emit("productCreated", product);
    return product;
  }

  async getProduct(id) {
    return this.db.findById(this.tableName, id);
  }

  async updateProduct(id, updates) {
    const product = await this.db.findById(this.tableName, id);
    if (!product) {
      throw new Error("Product not found");
    }

    if (updates.price !== undefined && updates.price < 0) {
      throw new ValidationError(
        "Price must be positive",
        "price",
        updates.price,
      );
    }

    if (updates.stock !== undefined && updates.stock < 0) {
      throw new ValidationError(
        "Stock must be non-negative",
        "stock",
        updates.stock,
      );
    }

    await this.db.update(
      this.tableName,
      { _id: id },
      { ...updates, updatedAt: new Date() },
    );

    const updated = await this.getProduct(id);
    this.emit("productUpdated", updated);
    return updated;
  }

  async deleteProduct(id) {
    const product = await this.db.findById(this.tableName, id);
    if (!product) {
      throw new Error("Product not found");
    }

    await this.db.delete(this.tableName, { _id: id });
    this.emit("productDeleted", { id });
    return true;
  }

  async listProducts(options = {}) {
    const query = {};

    if (options.category) {
      query.category = options.category;
    }

    if (options.status) {
      query.status = options.status;
    }

    if (options.minPrice !== undefined || options.maxPrice !== undefined) {
      query.price = {};
      if (options.minPrice !== undefined) {
        query.price.$gte = options.minPrice;
      }
      if (options.maxPrice !== undefined) {
        query.price.$lte = options.maxPrice;
      }
    }

    return this.db.findMany(this.tableName, query, {
      sort: options.sortBy
        ? { [options.sortBy]: options.sortOrder || 1 }
        : undefined,
      skip: options.offset,
      limit: options.limit,
    });
  }

  async searchProducts(searchTerm) {
    const allProducts = await this.db.findMany(this.tableName);
    const lowerSearch = searchTerm.toLowerCase();

    return allProducts.filter((product) => {
      return (
        product.name.toLowerCase().includes(lowerSearch) ||
        product.description.toLowerCase().includes(lowerSearch) ||
        product.tags.some((tag) => tag.toLowerCase().includes(lowerSearch))
      );
    });
  }

  async updateStock(id, quantity) {
    const product = await this.db.findById(this.tableName, id);
    if (!product) {
      throw new Error("Product not found");
    }

    const newStock = product.stock + quantity;
    if (newStock < 0) {
      throw new Error("Insufficient stock");
    }

    await this.updateProduct(id, { stock: newStock });
    this.emit("stockUpdated", { id, oldStock: product.stock, newStock });

    return newStock;
  }

  async getProductStats() {
    const total = await this.db.count(this.tableName);
    const active = await this.db.count(this.tableName, { status: "active" });
    const inactive = await this.db.count(this.tableName, {
      status: "inactive",
    });

    const allProducts = await this.db.findMany(this.tableName);
    const totalValue = allProducts.reduce(
      (sum, p) => sum + p.price * p.stock,
      0,
    );
    const outOfStock = allProducts.filter((p) => p.stock === 0).length;

    return {
      total,
      byStatus: {
        active,
        inactive,
      },
      inventory: {
        totalValue,
        outOfStock,
      },
    };
  }
}

// Order service
class OrderService extends EventEmitter {
  constructor(database, productService) {
    super();
    this.db = database;
    this.productService = productService;
    this.tableName = "orders";
  }

  async initialize() {
    this.db.createTable(this.tableName, {
      id: "string",
      userId: "string",
      items: "array",
      subtotal: "number",
      tax: "number",
      shipping: "number",
      total: "number",
      status: "string",
      shippingAddress: "object",
      billingAddress: "object",
      createdAt: "date",
      updatedAt: "date",
    });

    this.db.createIndex(this.tableName, "userId");
    this.db.createIndex(this.tableName, "status");
  }

  async createOrder(data) {
    Validator.validateRequired(data.userId, "userId");
    Validator.validateRequired(data.items, "items");
    Validator.validateRequired(data.shippingAddress, "shippingAddress");

    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new Error("Order must contain at least one item");
    }

    // Validate and calculate order totals
    const items = [];
    let subtotal = 0;

    for (const item of data.items) {
      const product = await this.productService.getProduct(item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for product ${product.name}`);
      }

      const itemTotal = product.price * item.quantity;
      items.push({
        productId: item.productId,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        total: itemTotal,
      });

      subtotal += itemTotal;
    }

    const tax = subtotal * 0.1; // 10% tax
    const shipping = this.calculateShipping(data.shippingAddress);
    const total = subtotal + tax + shipping;

    // Create order
    const order = await this.db.insert(this.tableName, {
      userId: data.userId,
      items,
      subtotal,
      tax,
      shipping,
      total,
      status: "pending",
      shippingAddress: data.shippingAddress,
      billingAddress: data.billingAddress || data.shippingAddress,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Update product stock
    for (const item of items) {
      await this.productService.updateStock(item.productId, -item.quantity);
    }

    this.emit("orderCreated", order);
    return order;
  }

  async getOrder(id) {
    return this.db.findById(this.tableName, id);
  }

  async listOrders(options = {}) {
    const query = {};

    if (options.userId) {
      query.userId = options.userId;
    }

    if (options.status) {
      query.status = options.status;
    }

    return this.db.findMany(this.tableName, query, {
      sort: { createdAt: -1 },
      skip: options.offset,
      limit: options.limit,
    });
  }

  async updateOrderStatus(id, status) {
    const validStatuses = [
      "pending",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ];
    Validator.validateEnum(status, validStatuses, "status");

    const order = await this.db.findById(this.tableName, id);
    if (!order) {
      throw new Error("Order not found");
    }

    await this.db.update(
      this.tableName,
      { _id: id },
      { status, updatedAt: new Date() },
    );

    const updated = await this.getOrder(id);
    this.emit("orderStatusUpdated", updated);
    return updated;
  }

  async cancelOrder(id) {
    const order = await this.db.findById(this.tableName, id);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status !== "pending") {
      throw new Error("Can only cancel pending orders");
    }

    // Restore product stock
    for (const item of order.items) {
      await this.productService.updateStock(item.productId, item.quantity);
    }

    await this.updateOrderStatus(id, "cancelled");
    this.emit("orderCancelled", { id });
    return true;
  }

  calculateShipping(address) {
    // Simple shipping calculation
    if (address.country === "US") {
      return 5.99;
    }
    if (address.country === "CA") {
      return 9.99;
    }
    return 15.99;
  }

  async getOrderStats(userId) {
    const query = userId ? { userId } : {};

    const total = await this.db.count(this.tableName, query);
    const pending = await this.db.count(this.tableName, {
      ...query,
      status: "pending",
    });
    const processing = await this.db.count(this.tableName, {
      ...query,
      status: "processing",
    });
    const shipped = await this.db.count(this.tableName, {
      ...query,
      status: "shipped",
    });
    const delivered = await this.db.count(this.tableName, {
      ...query,
      status: "delivered",
    });
    const cancelled = await this.db.count(this.tableName, {
      ...query,
      status: "cancelled",
    });

    const orders = await this.db.findMany(this.tableName, query);
    const totalRevenue = orders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + o.total, 0);

    return {
      total,
      byStatus: {
        pending,
        processing,
        shipped,
        delivered,
        cancelled,
      },
      revenue: {
        total: totalRevenue,
        average: total > 0 ? totalRevenue / total : 0,
      },
    };
  }
}

// Cache manager
class CacheManager {
  constructor(maxSize = 1000, ttl = 60000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    entry.hits++;
    return entry.value;
  }

  has(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    this.cleanup();
    return this.cache.size;
  }

  evictOldest() {
    let oldestKey;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  getStats() {
    const entries = Array.from(this.cache.values());
    const totalHits = entries.reduce((sum, e) => sum + e.hits, 0);
    const avgHits = entries.length > 0 ? totalHits / entries.length : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      totalHits,
      averageHits: avgHits,
    };
  }
}

// Export all classes and functions
module.exports = {
  ValidationError,
  Validator,
  Database,
  UserService,
  ProductService,
  OrderService,
  CacheManager,
};
