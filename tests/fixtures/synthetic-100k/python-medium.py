"""
Large Python file for performance benchmarking
Target: ~20,000 AST nodes
This file contains realistic Python patterns including classes, decorators,
type hints, async/await, dataclasses, and complex data structures.
"""

import asyncio
import hashlib
import json
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from functools import wraps
from typing import Any, Dict, List, Optional, Set, Tuple, Union
from uuid import uuid4


# Exceptions
class ValidationError(Exception):
    """Raised when validation fails."""

    def __init__(self, message: str, field: str, value: Any):
        super().__init__(message)
        self.field = field
        self.value = value


class NotFoundError(Exception):
    """Raised when a resource is not found."""

    pass


class DuplicateError(Exception):
    """Raised when a duplicate resource is detected."""

    pass


class AuthenticationError(Exception):
    """Raised when authentication fails."""

    pass


# Enums
class UserRole(Enum):
    """User role enumeration."""

    ADMIN = "admin"
    USER = "user"
    MODERATOR = "moderator"
    GUEST = "guest"


class UserStatus(Enum):
    """User status enumeration."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    DELETED = "deleted"


class OrderStatus(Enum):
    """Order status enumeration."""

    PENDING = "pending"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


# Dataclasses
@dataclass
class Address:
    """Address data model."""

    line1: str
    city: str
    state: str
    postal_code: str
    country: str
    line2: Optional[str] = None


@dataclass
class User:
    """User data model."""

    id: str
    username: str
    email: str
    first_name: str
    last_name: str
    role: UserRole
    status: UserStatus
    created_at: datetime
    updated_at: datetime
    date_of_birth: Optional[datetime] = None
    password_hash: Optional[str] = field(default=None, repr=False)


@dataclass
class Product:
    """Product data model."""

    id: str
    name: str
    description: str
    price: float
    currency: str
    category: str
    stock: int
    created_at: datetime
    updated_at: datetime
    tags: List[str] = field(default_factory=list)
    images: List[str] = field(default_factory=list)


@dataclass
class OrderItem:
    """Order item data model."""

    product_id: str
    product_name: str
    price: float
    quantity: int

    @property
    def total(self) -> float:
        """Calculate item total."""
        return self.price * self.quantity


@dataclass
class Order:
    """Order data model."""

    id: str
    user_id: str
    items: List[OrderItem]
    status: OrderStatus
    shipping_address: Address
    billing_address: Address
    created_at: datetime
    updated_at: datetime

    @property
    def subtotal(self) -> float:
        """Calculate order subtotal."""
        return sum(item.total for item in self.items)

    @property
    def tax(self) -> float:
        """Calculate order tax (10%)."""
        return self.subtotal * 0.1

    @property
    def shipping(self) -> float:
        """Calculate shipping cost."""
        if self.shipping_address.country == "US":
            return 5.99
        return 15.99

    @property
    def total(self) -> float:
        """Calculate order total."""
        return self.subtotal + self.tax + self.shipping


# Validators
class Validator:
    """Collection of validation methods."""

    @staticmethod
    def validate_email(email: str) -> bool:
        """Validate email format."""
        pattern = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
        if not re.match(pattern, email):
            raise ValidationError("Invalid email format", "email", email)
        return True

    @staticmethod
    def validate_username(username: str) -> bool:
        """Validate username format."""
        if not isinstance(username, str):
            raise ValidationError("Username must be a string", "username", username)
        if len(username) < 3 or len(username) > 20:
            raise ValidationError(
                "Username must be 3-20 characters", "username", username
            )
        if not re.match(r"^[a-zA-Z0-9_]+$", username):
            raise ValidationError(
                "Username must be alphanumeric", "username", username
            )
        return True

    @staticmethod
    def validate_password(password: str) -> bool:
        """Validate password strength."""
        if not isinstance(password, str):
            raise ValidationError("Password must be a string", "password", password)
        if len(password) < 8:
            raise ValidationError(
                "Password must be at least 8 characters", "password", password
            )
        if not re.search(r"[A-Z]", password):
            raise ValidationError(
                "Password must contain uppercase letter", "password", password
            )
        if not re.search(r"[a-z]", password):
            raise ValidationError(
                "Password must contain lowercase letter", "password", password
            )
        if not re.search(r"[0-9]", password):
            raise ValidationError(
                "Password must contain number", "password", password
            )
        return True

    @staticmethod
    def validate_required(value: Any, field: str) -> bool:
        """Validate that value is not empty."""
        if value is None or value == "":
            raise ValidationError(f"{field} is required", field, value)
        return True

    @staticmethod
    def validate_length(value: str, min_len: int, max_len: int, field: str) -> bool:
        """Validate string length."""
        if len(value) < min_len or len(value) > max_len:
            raise ValidationError(
                f"{field} must be between {min_len} and {max_len} characters",
                field,
                value,
            )
        return True

    @staticmethod
    def validate_range(
        value: Union[int, float], min_val: Union[int, float], max_val: Union[int, float], field: str
    ) -> bool:
        """Validate numeric range."""
        if value < min_val or value > max_val:
            raise ValidationError(
                f"{field} must be between {min_val} and {max_val}", field, value
            )
        return True

    @staticmethod
    def validate_enum(value: Any, allowed: List[Any], field: str) -> bool:
        """Validate value is in allowed list."""
        if value not in allowed:
            raise ValidationError(
                f"{field} must be one of: {', '.join(str(v) for v in allowed)}",
                field,
                value,
            )
        return True


# Database abstraction
class Database:
    """In-memory database implementation."""

    def __init__(self):
        """Initialize database."""
        self.tables: Dict[str, Dict[str, Any]] = {}
        self.indexes: Dict[str, Dict[str, Set[str]]] = {}

    def create_table(self, name: str, schema: Dict[str, str]) -> None:
        """Create a new table."""
        if name in self.tables:
            raise ValueError(f"Table {name} already exists")
        self.tables[name] = {}
        self.indexes[name] = {}

    def drop_table(self, name: str) -> None:
        """Drop a table."""
        if name not in self.tables:
            raise ValueError(f"Table {name} does not exist")
        del self.tables[name]
        del self.indexes[name]

    def create_index(self, table: str, field: str) -> None:
        """Create an index on a field."""
        if table not in self.tables:
            raise ValueError(f"Table {table} does not exist")
        self.indexes[table][field] = set()

    def insert(self, table: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Insert a document into a table."""
        if table not in self.tables:
            raise ValueError(f"Table {table} does not exist")

        doc_id = data.get("id") or str(uuid4())
        doc = {**data, "id": doc_id}
        self.tables[table][doc_id] = doc

        # Update indexes
        for field, index in self.indexes[table].items():
            if field in doc:
                index.add(doc_id)

        return doc

    def find_by_id(self, table: str, doc_id: str) -> Optional[Dict[str, Any]]:
        """Find a document by ID."""
        if table not in self.tables:
            raise ValueError(f"Table {table} does not exist")
        return self.tables[table].get(doc_id)

    def find_one(self, table: str, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Find one document matching query."""
        if table not in self.tables:
            raise ValueError(f"Table {table} does not exist")

        for doc in self.tables[table].values():
            if self._matches_query(doc, query):
                return doc
        return None

    def find_many(
        self, table: str, query: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Find all documents matching query."""
        if table not in self.tables:
            raise ValueError(f"Table {table} does not exist")

        query = query or {}
        results = []
        for doc in self.tables[table].values():
            if self._matches_query(doc, query):
                results.append(doc)
        return results

    def update(self, table: str, doc_id: str, updates: Dict[str, Any]) -> bool:
        """Update a document."""
        if table not in self.tables:
            raise ValueError(f"Table {table} does not exist")

        if doc_id not in self.tables[table]:
            return False

        self.tables[table][doc_id].update(updates)
        return True

    def delete(self, table: str, doc_id: str) -> bool:
        """Delete a document."""
        if table not in self.tables:
            raise ValueError(f"Table {table} does not exist")

        if doc_id not in self.tables[table]:
            return False

        del self.tables[table][doc_id]
        return True

    def count(
        self, table: str, query: Optional[Dict[str, Any]] = None
    ) -> int:
        """Count documents matching query."""
        if table not in self.tables:
            raise ValueError(f"Table {table} does not exist")

        if query is None:
            return len(self.tables[table])

        count = 0
        for doc in self.tables[table].values():
            if self._matches_query(doc, query):
                count += 1
        return count

    def _matches_query(self, doc: Dict[str, Any], query: Dict[str, Any]) -> bool:
        """Check if document matches query."""
        for key, value in query.items():
            if key not in doc:
                return False
            if isinstance(value, dict):
                # Handle operators
                doc_value = doc[key]
                if "$eq" in value and doc_value != value["$eq"]:
                    return False
                if "$ne" in value and doc_value == value["$ne"]:
                    return False
                if "$gt" in value and doc_value <= value["$gt"]:
                    return False
                if "$gte" in value and doc_value < value["$gte"]:
                    return False
                if "$lt" in value and doc_value >= value["$lt"]:
                    return False
                if "$lte" in value and doc_value > value["$lte"]:
                    return False
                if "$in" in value and doc_value not in value["$in"]:
                    return False
                if "$nin" in value and doc_value in value["$nin"]:
                    return False
            else:
                if doc[key] != value:
                    return False
        return True


# Services
class BaseService(ABC):
    """Base service class."""

    def __init__(self, database: Database, table_name: str):
        """Initialize service."""
        self.db = database
        self.table_name = table_name

    @abstractmethod
    def initialize(self) -> None:
        """Initialize service tables and indexes."""
        pass


class UserService(BaseService):
    """User management service."""

    def __init__(self, database: Database):
        """Initialize user service."""
        super().__init__(database, "users")

    def initialize(self) -> None:
        """Initialize user table."""
        self.db.create_table(
            self.table_name,
            {
                "id": "str",
                "username": "str",
                "email": "str",
                "password_hash": "str",
                "first_name": "str",
                "last_name": "str",
                "role": "str",
                "status": "str",
                "created_at": "datetime",
                "updated_at": "datetime",
            },
        )
        self.db.create_index(self.table_name, "username")
        self.db.create_index(self.table_name, "email")

    def create_user(
        self,
        username: str,
        email: str,
        password: str,
        first_name: str,
        last_name: str,
        role: UserRole = UserRole.USER,
        date_of_birth: Optional[datetime] = None,
    ) -> User:
        """Create a new user."""
        # Validate inputs
        Validator.validate_required(username, "username")
        Validator.validate_required(email, "email")
        Validator.validate_required(password, "password")
        Validator.validate_username(username)
        Validator.validate_email(email)
        Validator.validate_password(password)

        # Check for duplicates
        if self.db.find_one(self.table_name, {"username": username}):
            raise DuplicateError(f"Username {username} already exists")
        if self.db.find_one(self.table_name, {"email": email}):
            raise DuplicateError(f"Email {email} already exists")

        # Hash password
        password_hash = self._hash_password(password)

        # Create user
        now = datetime.now()
        user_data = {
            "id": str(uuid4()),
            "username": username,
            "email": email,
            "password_hash": password_hash,
            "first_name": first_name,
            "last_name": last_name,
            "role": role.value,
            "status": UserStatus.ACTIVE.value,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "date_of_birth": date_of_birth.isoformat() if date_of_birth else None,
        }

        doc = self.db.insert(self.table_name, user_data)
        return self._doc_to_user(doc)

    def get_user_by_id(self, user_id: str) -> Optional[User]:
        """Get user by ID."""
        doc = self.db.find_by_id(self.table_name, user_id)
        return self._doc_to_user(doc) if doc else None

    def get_user_by_username(self, username: str) -> Optional[User]:
        """Get user by username."""
        doc = self.db.find_one(self.table_name, {"username": username})
        return self._doc_to_user(doc) if doc else None

    def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email."""
        doc = self.db.find_one(self.table_name, {"email": email})
        return self._doc_to_user(doc) if doc else None

    def update_user(self, user_id: str, **updates) -> User:
        """Update user."""
        user = self.get_user_by_id(user_id)
        if not user:
            raise NotFoundError(f"User {user_id} not found")

        # Validate updates
        if "username" in updates:
            Validator.validate_username(updates["username"])
            existing = self.db.find_one(self.table_name, {"username": updates["username"]})
            if existing and existing["id"] != user_id:
                raise DuplicateError(f"Username {updates['username']} already exists")

        if "email" in updates:
            Validator.validate_email(updates["email"])
            existing = self.db.find_one(self.table_name, {"email": updates["email"]})
            if existing and existing["id"] != user_id:
                raise DuplicateError(f"Email {updates['email']} already exists")

        if "password" in updates:
            Validator.validate_password(updates["password"])
            updates["password_hash"] = self._hash_password(updates.pop("password"))

        updates["updated_at"] = datetime.now().isoformat()
        self.db.update(self.table_name, user_id, updates)
        
        updated_user = self.get_user_by_id(user_id)
        if not updated_user:
            raise NotFoundError(f"User {user_id} not found after update")
        return updated_user

    def delete_user(self, user_id: str) -> bool:
        """Delete user."""
        return self.db.delete(self.table_name, user_id)

    def list_users(
        self, role: Optional[UserRole] = None, status: Optional[UserStatus] = None
    ) -> List[User]:
        """List users with optional filters."""
        query = {}
        if role:
            query["role"] = role.value
        if status:
            query["status"] = status.value

        docs = self.db.find_many(self.table_name, query)
        return [self._doc_to_user(doc) for doc in docs]

    def search_users(self, search_term: str) -> List[User]:
        """Search users by username, email, or name."""
        all_users = self.list_users()
        search_lower = search_term.lower()
        
        results = []
        for user in all_users:
            if (
                search_lower in user.username.lower()
                or search_lower in user.email.lower()
                or search_lower in user.first_name.lower()
                or search_lower in user.last_name.lower()
            ):
                results.append(user)
        
        return results

    def authenticate_user(self, username: str, password: str) -> User:
        """Authenticate user with username and password."""
        user_doc = self.db.find_one(self.table_name, {"username": username})
        if not user_doc:
            raise AuthenticationError("Invalid credentials")

        password_hash = self._hash_password(password)
        if user_doc["password_hash"] != password_hash:
            raise AuthenticationError("Invalid credentials")

        return self._doc_to_user(user_doc)

    def change_password(self, user_id: str, old_password: str, new_password: str) -> bool:
        """Change user password."""
        user_doc = self.db.find_by_id(self.table_name, user_id)
        if not user_doc:
            raise NotFoundError(f"User {user_id} not found")

        old_hash = self._hash_password(old_password)
        if user_doc["password_hash"] != old_hash:
            raise AuthenticationError("Invalid current password")

        Validator.validate_password(new_password)
        new_hash = self._hash_password(new_password)
        
        return self.db.update(
            self.table_name,
            user_id,
            {"password_hash": new_hash, "updated_at": datetime.now().isoformat()},
        )

    def get_user_stats(self) -> Dict[str, Any]:
        """Get user statistics."""
        total = self.db.count(self.table_name)
        active = self.db.count(self.table_name, {"status": UserStatus.ACTIVE.value})
        inactive = self.db.count(self.table_name, {"status": UserStatus.INACTIVE.value})
        admins = self.db.count(self.table_name, {"role": UserRole.ADMIN.value})
        users = self.db.count(self.table_name, {"role": UserRole.USER.value})

        return {
            "total": total,
            "by_status": {"active": active, "inactive": inactive},
            "by_role": {"admin": admins, "user": users},
        }

    def _hash_password(self, password: str) -> str:
        """Hash password using SHA-256."""
        return hashlib.sha256(password.encode()).hexdigest()

    def _doc_to_user(self, doc: Dict[str, Any]) -> User:
        """Convert document to User dataclass."""
        return User(
            id=doc["id"],
            username=doc["username"],
            email=doc["email"],
            first_name=doc["first_name"],
            last_name=doc["last_name"],
            role=UserRole(doc["role"]),
            status=UserStatus(doc["status"]),
            created_at=datetime.fromisoformat(doc["created_at"]),
            updated_at=datetime.fromisoformat(doc["updated_at"]),
            date_of_birth=(
                datetime.fromisoformat(doc["date_of_birth"])
                if doc.get("date_of_birth")
                else None
            ),
            password_hash=doc.get("password_hash"),
        )


class ProductService(BaseService):
    """Product management service."""

    def __init__(self, database: Database):
        """Initialize product service."""
        super().__init__(database, "products")

    def initialize(self) -> None:
        """Initialize product table."""
        self.db.create_table(
            self.table_name,
            {
                "id": "str",
                "name": "str",
                "description": "str",
                "price": "float",
                "currency": "str",
                "category": "str",
                "stock": "int",
                "tags": "list",
                "images": "list",
                "created_at": "datetime",
                "updated_at": "datetime",
            },
        )
        self.db.create_index(self.table_name, "category")

    def create_product(
        self,
        name: str,
        description: str,
        price: float,
        category: str,
        stock: int = 0,
        currency: str = "USD",
        tags: Optional[List[str]] = None,
        images: Optional[List[str]] = None,
    ) -> Product:
        """Create a new product."""
        Validator.validate_required(name, "name")
        Validator.validate_required(price, "price")
        Validator.validate_required(category, "category")

        if price < 0:
            raise ValidationError("Price must be positive", "price", price)
        if stock < 0:
            raise ValidationError("Stock must be non-negative", "stock", stock)

        now = datetime.now()
        product_data = {
            "id": str(uuid4()),
            "name": name,
            "description": description,
            "price": price,
            "currency": currency,
            "category": category,
            "stock": stock,
            "tags": tags or [],
            "images": images or [],
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }

        doc = self.db.insert(self.table_name, product_data)
        return self._doc_to_product(doc)

    def get_product(self, product_id: str) -> Optional[Product]:
        """Get product by ID."""
        doc = self.db.find_by_id(self.table_name, product_id)
        return self._doc_to_product(doc) if doc else None

    def update_product(self, product_id: str, **updates) -> Product:
        """Update product."""
        product = self.get_product(product_id)
        if not product:
            raise NotFoundError(f"Product {product_id} not found")

        if "price" in updates and updates["price"] < 0:
            raise ValidationError("Price must be positive", "price", updates["price"])
        if "stock" in updates and updates["stock"] < 0:
            raise ValidationError("Stock must be non-negative", "stock", updates["stock"])

        updates["updated_at"] = datetime.now().isoformat()
        self.db.update(self.table_name, product_id, updates)
        
        updated_product = self.get_product(product_id)
        if not updated_product:
            raise NotFoundError(f"Product {product_id} not found after update")
        return updated_product

    def delete_product(self, product_id: str) -> bool:
        """Delete product."""
        return self.db.delete(self.table_name, product_id)

    def list_products(self, category: Optional[str] = None) -> List[Product]:
        """List products with optional category filter."""
        query = {}
        if category:
            query["category"] = category

        docs = self.db.find_many(self.table_name, query)
        return [self._doc_to_product(doc) for doc in docs]

    def search_products(self, search_term: str) -> List[Product]:
        """Search products by name, description, or tags."""
        all_products = self.list_products()
        search_lower = search_term.lower()
        
        results = []
        for product in all_products:
            if (
                search_lower in product.name.lower()
                or search_lower in product.description.lower()
                or any(search_lower in tag.lower() for tag in product.tags)
            ):
                results.append(product)
        
        return results

    def update_stock(self, product_id: str, quantity: int) -> int:
        """Update product stock."""
        product = self.get_product(product_id)
        if not product:
            raise NotFoundError(f"Product {product_id} not found")

        new_stock = product.stock + quantity
        if new_stock < 0:
            raise ValidationError("Insufficient stock", "stock", new_stock)

        self.update_product(product_id, stock=new_stock)
        return new_stock

    def get_product_stats(self) -> Dict[str, Any]:
        """Get product statistics."""
        all_products = self.list_products()
        total = len(all_products)
        
        total_value = sum(p.price * p.stock for p in all_products)
        out_of_stock = sum(1 for p in all_products if p.stock == 0)
        
        categories = {}
        for product in all_products:
            categories[product.category] = categories.get(product.category, 0) + 1

        return {
            "total": total,
            "inventory": {"total_value": total_value, "out_of_stock": out_of_stock},
            "by_category": categories,
        }

    def _doc_to_product(self, doc: Dict[str, Any]) -> Product:
        """Convert document to Product dataclass."""
        return Product(
            id=doc["id"],
            name=doc["name"],
            description=doc["description"],
            price=doc["price"],
            currency=doc["currency"],
            category=doc["category"],
            stock=doc["stock"],
            tags=doc.get("tags", []),
            images=doc.get("images", []),
            created_at=datetime.fromisoformat(doc["created_at"]),
            updated_at=datetime.fromisoformat(doc["updated_at"]),
        )


class OrderService(BaseService):
    """Order management service."""

    def __init__(self, database: Database, product_service: ProductService):
        """Initialize order service."""
        super().__init__(database, "orders")
        self.product_service = product_service

    def initialize(self) -> None:
        """Initialize order table."""
        self.db.create_table(
            self.table_name,
            {
                "id": "str",
                "user_id": "str",
                "items": "list",
                "status": "str",
                "shipping_address": "dict",
                "billing_address": "dict",
                "created_at": "datetime",
                "updated_at": "datetime",
            },
        )
        self.db.create_index(self.table_name, "user_id")
        self.db.create_index(self.table_name, "status")

    def create_order(
        self,
        user_id: str,
        items: List[Tuple[str, int]],  # List of (product_id, quantity)
        shipping_address: Address,
        billing_address: Optional[Address] = None,
    ) -> Order:
        """Create a new order."""
        Validator.validate_required(user_id, "user_id")
        Validator.validate_required(items, "items")
        Validator.validate_required(shipping_address, "shipping_address")

        if not items:
            raise ValidationError("Order must contain at least one item", "items", items)

        # Validate items and build order items
        order_items = []
        for product_id, quantity in items:
            product = self.product_service.get_product(product_id)
            if not product:
                raise NotFoundError(f"Product {product_id} not found")
            
            if product.stock < quantity:
                raise ValidationError(
                    f"Insufficient stock for product {product.name}",
                    "quantity",
                    quantity,
                )

            order_items.append(
                OrderItem(
                    product_id=product_id,
                    product_name=product.name,
                    price=product.price,
                    quantity=quantity,
                )
            )

        # Create order
        now = datetime.now()
        order_data = {
            "id": str(uuid4()),
            "user_id": user_id,
            "items": [
                {
                    "product_id": item.product_id,
                    "product_name": item.product_name,
                    "price": item.price,
                    "quantity": item.quantity,
                }
                for item in order_items
            ],
            "status": OrderStatus.PENDING.value,
            "shipping_address": {
                "line1": shipping_address.line1,
                "line2": shipping_address.line2,
                "city": shipping_address.city,
                "state": shipping_address.state,
                "postal_code": shipping_address.postal_code,
                "country": shipping_address.country,
            },
            "billing_address": (
                {
                    "line1": billing_address.line1,
                    "line2": billing_address.line2,
                    "city": billing_address.city,
                    "state": billing_address.state,
                    "postal_code": billing_address.postal_code,
                    "country": billing_address.country,
                }
                if billing_address
                else None
            ),
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }

        doc = self.db.insert(self.table_name, order_data)

        # Update product stock
        for item in order_items:
            self.product_service.update_stock(item.product_id, -item.quantity)

        return self._doc_to_order(doc)

    def get_order(self, order_id: str) -> Optional[Order]:
        """Get order by ID."""
        doc = self.db.find_by_id(self.table_name, order_id)
        return self._doc_to_order(doc) if doc else None

    def list_orders(
        self,
        user_id: Optional[str] = None,
        status: Optional[OrderStatus] = None,
    ) -> List[Order]:
        """List orders with optional filters."""
        query = {}
        if user_id:
            query["user_id"] = user_id
        if status:
            query["status"] = status.value

        docs = self.db.find_many(self.table_name, query)
        return [self._doc_to_order(doc) for doc in docs]

    def update_order_status(self, order_id: str, status: OrderStatus) -> Order:
        """Update order status."""
        order = self.get_order(order_id)
        if not order:
            raise NotFoundError(f"Order {order_id} not found")

        self.db.update(
            self.table_name,
            order_id,
            {"status": status.value, "updated_at": datetime.now().isoformat()},
        )
        
        updated_order = self.get_order(order_id)
        if not updated_order:
            raise NotFoundError(f"Order {order_id} not found after update")
        return updated_order

    def cancel_order(self, order_id: str) -> bool:
        """Cancel an order."""
        order = self.get_order(order_id)
        if not order:
            raise NotFoundError(f"Order {order_id} not found")

        if order.status != OrderStatus.PENDING:
            raise ValidationError(
                "Can only cancel pending orders", "status", order.status.value
            )

        # Restore product stock
        for item in order.items:
            self.product_service.update_stock(item.product_id, item.quantity)

        self.update_order_status(order_id, OrderStatus.CANCELLED)
        return True

    def get_order_stats(self, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Get order statistics."""
        orders = self.list_orders(user_id=user_id)
        
        total = len(orders)
        by_status = {}
        total_revenue = 0.0

        for order in orders:
            status = order.status.value
            by_status[status] = by_status.get(status, 0) + 1
            
            if order.status != OrderStatus.CANCELLED:
                total_revenue += order.total

        return {
            "total": total,
            "by_status": by_status,
            "revenue": {
                "total": total_revenue,
                "average": total_revenue / total if total > 0 else 0,
            },
        }

    def _doc_to_order(self, doc: Dict[str, Any]) -> Order:
        """Convert document to Order dataclass."""
        items = [
            OrderItem(
                product_id=item["product_id"],
                product_name=item["product_name"],
                price=item["price"],
                quantity=item["quantity"],
            )
            for item in doc["items"]
        ]

        shipping_addr = doc["shipping_address"]
        billing_addr = doc.get("billing_address") or shipping_addr

        return Order(
            id=doc["id"],
            user_id=doc["user_id"],
            items=items,
            status=OrderStatus(doc["status"]),
            shipping_address=Address(
                line1=shipping_addr["line1"],
                line2=shipping_addr.get("line2"),
                city=shipping_addr["city"],
                state=shipping_addr["state"],
                postal_code=shipping_addr["postal_code"],
                country=shipping_addr["country"],
            ),
            billing_address=Address(
                line1=billing_addr["line1"],
                line2=billing_addr.get("line2"),
                city=billing_addr["city"],
                state=billing_addr["state"],
                postal_code=billing_addr["postal_code"],
                country=billing_addr["country"],
            ),
            created_at=datetime.fromisoformat(doc["created_at"]),
            updated_at=datetime.fromisoformat(doc["updated_at"]),
        )


# Cache manager
class CacheManager:
    """Simple in-memory cache manager."""

    def __init__(self, max_size: int = 1000, ttl: int = 60):
        """Initialize cache manager."""
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.max_size = max_size
        self.ttl = ttl

    def set(self, key: str, value: Any) -> None:
        """Set cache value."""
        if len(self.cache) >= self.max_size:
            self._evict_oldest()

        self.cache[key] = {
            "value": value,
            "timestamp": datetime.now(),
            "hits": 0,
        }

    def get(self, key: str) -> Optional[Any]:
        """Get cache value."""
        entry = self.cache.get(key)
        if not entry:
            return None

        age = (datetime.now() - entry["timestamp"]).total_seconds()
        if age > self.ttl:
            del self.cache[key]
            return None

        entry["hits"] += 1
        return entry["value"]

    def delete(self, key: str) -> bool:
        """Delete cache value."""
        if key in self.cache:
            del self.cache[key]
            return True
        return False

    def clear(self) -> None:
        """Clear all cache entries."""
        self.cache.clear()

    def size(self) -> int:
        """Get cache size."""
        self._cleanup()
        return len(self.cache)

    def _evict_oldest(self) -> None:
        """Evict oldest cache entry."""
        if not self.cache:
            return

        oldest_key = min(
            self.cache.keys(), key=lambda k: self.cache[k]["timestamp"]
        )
        del self.cache[oldest_key]

    def _cleanup(self) -> None:
        """Remove expired cache entries."""
        now = datetime.now()
        expired_keys = [
            key
            for key, entry in self.cache.items()
            if (now - entry["timestamp"]).total_seconds() > self.ttl
        ]
        for key in expired_keys:
            del self.cache[key]

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        total_hits = sum(entry["hits"] for entry in self.cache.values())
        avg_hits = total_hits / len(self.cache) if self.cache else 0

        return {
            "size": len(self.cache),
            "max_size": self.maxsize,
            "total_hits": total_hits,
            "average_hits": avg_hits,
        }
