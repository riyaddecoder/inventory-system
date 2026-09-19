// Auto-generated fallback OpenAPI specification
export const fallbackSwaggerSpec = {
  "openapi": "3.0.0",
  "info": {
    "title": "E-commerce API",
    "version": "1.0.0",
    "description": "High-Performance Order Processing & Inventory API"
  },
  "servers": [
    {
      "url": "https://inventorymanager.sariyad.com",
      "description": "Production server"
    },
    {
      "url": "http://localhost:3000",
      "description": "Local development server"
    },
    {
      "url": "/",
      "description": "Current server"
    }
  ],
  "components": {
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT"
      }
    }
  },
  "security": [
    {
      "bearerAuth": []
    }
  ],
  "paths": {
    "/api": {
      "get": {
        "summary": "API root health check",
        "tags": [
          "General"
        ],
        "responses": {
          "200": {
            "description": "API working"
          }
        }
      }
    },
    "/api/auth/register": {
      "post": {
        "summary": "Register a new user",
        "tags": [
          "Auth"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "email",
                  "password"
                ],
                "properties": {
                  "email": {
                    "type": "string",
                    "example": "user@example.com"
                  },
                  "password": {
                    "type": "string",
                    "example": "password123"
                  },
                  "role": {
                    "type": "string",
                    "enum": [
                      "customer",
                      "admin"
                    ],
                    "default": "customer"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "User created successfully"
          },
          "400": {
            "description": "Validation failed"
          },
          "409": {
            "description": "User already exists"
          }
        }
      }
    },
    "/api/auth/login": {
      "post": {
        "summary": "Login user",
        "tags": [
          "Auth"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "email",
                  "password"
                ],
                "properties": {
                  "email": {
                    "type": "string"
                  },
                  "password": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Login successful"
          },
          "401": {
            "description": "Invalid credentials"
          }
        }
      }
    },
    "/api/users/me": {
      "get": {
        "summary": "Get current authenticated user profile",
        "tags": [
          "Users"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Current user details"
          }
        }
      }
    },
    "/api/users": {
      "get": {
        "summary": "List all users (Admin only)",
        "tags": [
          "Users"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "query",
            "name": "page",
            "schema": {
              "type": "integer"
            }
          },
          {
            "in": "query",
            "name": "limit",
            "schema": {
              "type": "integer"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Paginated users list"
          }
        }
      }
    },
    "/api/categories": {
      "get": {
        "summary": "Get all product categories (Cached)",
        "tags": [
          "Categories"
        ],
        "responses": {
          "200": {
            "description": "List of categories"
          }
        }
      },
      "post": {
        "summary": "Create a category (Admin only)",
        "tags": [
          "Categories"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "name"
                ],
                "properties": {
                  "name": {
                    "type": "string"
                  },
                  "description": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Category created"
          },
          "409": {
            "description": "Category already exists"
          }
        }
      }
    },
    "/api/categories/{id}": {
      "get": {
        "summary": "Get category by ID",
        "tags": [
          "Categories"
        ],
        "parameters": [
          {
            "in": "path",
            "name": "id",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Category details with associated products"
          },
          "404": {
            "description": "Category not found"
          }
        }
      },
      "put": {
        "summary": "Update category (Admin only)",
        "tags": [
          "Categories"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "path",
            "name": "id",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "name": {
                    "type": "string"
                  },
                  "description": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Category updated"
          }
        }
      },
      "delete": {
        "summary": "Delete category (Admin only)",
        "tags": [
          "Categories"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "path",
            "name": "id",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Category deleted"
          }
        }
      }
    },
    "/api/products": {
      "get": {
        "summary": "Search and filter products with pagination (Cached)",
        "tags": [
          "Products"
        ],
        "parameters": [
          {
            "in": "query",
            "name": "q",
            "description": "Search keyword (name or description)",
            "schema": {
              "type": "string"
            }
          },
          {
            "in": "query",
            "name": "categoryId",
            "schema": {
              "type": "string"
            }
          },
          {
            "in": "query",
            "name": "minPrice",
            "schema": {
              "type": "number"
            }
          },
          {
            "in": "query",
            "name": "maxPrice",
            "schema": {
              "type": "number"
            }
          },
          {
            "in": "query",
            "name": "inStock",
            "schema": {
              "type": "boolean"
            }
          },
          {
            "in": "query",
            "name": "sortBy",
            "schema": {
              "type": "string",
              "enum": [
                "price",
                "createdAt",
                "name"
              ]
            }
          },
          {
            "in": "query",
            "name": "sortOrder",
            "schema": {
              "type": "string",
              "enum": [
                "ASC",
                "DESC"
              ]
            }
          },
          {
            "in": "query",
            "name": "page",
            "schema": {
              "type": "integer"
            }
          },
          {
            "in": "query",
            "name": "limit",
            "schema": {
              "type": "integer"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Paginated product list"
          }
        }
      },
      "post": {
        "summary": "Create a new product with initial stock (Admin only)",
        "tags": [
          "Products"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "name",
                  "description",
                  "price",
                  "categoryId"
                ],
                "properties": {
                  "name": {
                    "type": "string"
                  },
                  "description": {
                    "type": "string"
                  },
                  "price": {
                    "type": "number"
                  },
                  "categoryId": {
                    "type": "string"
                  },
                  "initialQuantity": {
                    "type": "integer"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Product created"
          }
        }
      }
    },
    "/api/products/{id}": {
      "get": {
        "summary": "Get product details by ID (Cached)",
        "tags": [
          "Products"
        ],
        "parameters": [
          {
            "in": "path",
            "name": "id",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Product details"
          },
          "404": {
            "description": "Product not found"
          }
        }
      },
      "put": {
        "summary": "Update product (Admin only)",
        "tags": [
          "Products"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "path",
            "name": "id",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "name": {
                    "type": "string"
                  },
                  "description": {
                    "type": "string"
                  },
                  "price": {
                    "type": "number"
                  },
                  "categoryId": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Product updated"
          }
        }
      },
      "delete": {
        "summary": "Delete product (Admin only)",
        "tags": [
          "Products"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "path",
            "name": "id",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Product deleted"
          }
        }
      }
    },
    "/api/inventory/low-stock": {
      "get": {
        "summary": "Get low stock products (Admin only)",
        "tags": [
          "Inventory"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "List of low-stock products"
          }
        }
      }
    },
    "/api/inventory/reserve": {
      "post": {
        "summary": "Reserve stock for checkout",
        "tags": [
          "Inventory"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "productId",
                  "quantity"
                ],
                "properties": {
                  "productId": {
                    "type": "string"
                  },
                  "quantity": {
                    "type": "integer"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Stock reserved successfully"
          },
          "400": {
            "description": "Insufficient stock"
          }
        }
      }
    },
    "/api/inventory/{productId}": {
      "get": {
        "summary": "Get stock availability for product",
        "tags": [
          "Inventory"
        ],
        "parameters": [
          {
            "in": "path",
            "name": "productId",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Stock availability details"
          }
        }
      },
      "patch": {
        "summary": "Update stock / restock product (Admin only)",
        "tags": [
          "Inventory"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "path",
            "name": "productId",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "quantity": {
                    "type": "integer"
                  },
                  "restockAmount": {
                    "type": "integer"
                  },
                  "lowStockThreshold": {
                    "type": "integer"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Stock updated"
          }
        }
      }
    },
    "/api/orders": {
      "post": {
        "summary": "Create a new order (Idempotent & Concurrency-Safe)",
        "tags": [
          "Orders"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "header",
            "name": "idempotency-key",
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "items"
                ],
                "properties": {
                  "items": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "required": [
                        "productId",
                        "quantity"
                      ],
                      "properties": {
                        "productId": {
                          "type": "string"
                        },
                        "quantity": {
                          "type": "integer"
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Order created successfully"
          },
          "400": {
            "description": "Validation failed"
          },
          "401": {
            "description": "Unauthorized"
          },
          "409": {
            "description": "Insufficient stock"
          }
        }
      },
      "get": {
        "summary": "Get user orders (Customer) or all orders (Admin)",
        "tags": [
          "Orders"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "query",
            "name": "page",
            "schema": {
              "type": "integer"
            }
          },
          {
            "in": "query",
            "name": "limit",
            "schema": {
              "type": "integer"
            }
          },
          {
            "in": "query",
            "name": "status",
            "schema": {
              "type": "string",
              "enum": [
                "pending",
                "confirmed",
                "shipped",
                "delivered",
                "cancelled"
              ]
            }
          },
          {
            "in": "query",
            "name": "startDate",
            "schema": {
              "type": "string"
            }
          },
          {
            "in": "query",
            "name": "endDate",
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "List of orders"
          }
        }
      }
    },
    "/api/orders/{id}": {
      "get": {
        "summary": "Get order details by ID",
        "tags": [
          "Orders"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "path",
            "name": "id",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Order details"
          },
          "404": {
            "description": "Order not found"
          }
        }
      }
    },
    "/api/orders/{id}/cancel": {
      "patch": {
        "summary": "Cancel order and restore inventory",
        "tags": [
          "Orders"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "path",
            "name": "id",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Order cancelled and stock restored"
          },
          "400": {
            "description": "Order is already cancelled or cannot be cancelled"
          },
          "401": {
            "description": "Unauthorized"
          },
          "403": {
            "description": "Forbidden (cannot cancel another user's order)"
          },
          "404": {
            "description": "Order not found"
          }
        }
      }
    },
    "/api/orders/{id}/status": {
      "patch": {
        "summary": "Update order status (Admin only)",
        "tags": [
          "Orders"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "path",
            "name": "id",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "status"
                ],
                "properties": {
                  "status": {
                    "type": "string",
                    "enum": [
                      "pending",
                      "confirmed",
                      "shipped",
                      "delivered",
                      "cancelled"
                    ]
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Order status updated"
          }
        }
      }
    },
    "/api/reports/sales": {
      "get": {
        "summary": "Sales and revenue analytics report (Admin only)",
        "tags": [
          "Reports"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "query",
            "name": "startDate",
            "schema": {
              "type": "string"
            }
          },
          {
            "in": "query",
            "name": "endDate",
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Sales metrics and status breakdown"
          }
        }
      }
    },
    "/api/reports/top-products": {
      "get": {
        "summary": "Top selling products report (Admin only)",
        "tags": [
          "Reports"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "in": "query",
            "name": "limit",
            "schema": {
              "type": "integer"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Top selling products by units sold and revenue"
          }
        }
      }
    },
    "/api/reports/categories": {
      "get": {
        "summary": "Category performance report (Admin only)",
        "tags": [
          "Reports"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Category sales and unit volumes"
          }
        }
      }
    }
  },
  "tags": []
};
