/**
 * DayFlow OpenAPI 3.0 Specification & Swagger UI Setup
 */
export const openApiDocument = {
  openapi: '3.0.0',
  info: {
    title: 'DayFlow REST API Specification',
    version: '2.3.0',
    description: 'Interactive API documentation for DayFlow multi-view schedule planner, habit ledger, and focus tracker. Test endpoints directly with "Try it out".'
  },
  servers: [
    {
      url: 'http://localhost:5000/api',
      description: 'DayFlow REST API Server'
    }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token obtained from /auth/login or /auth/register'
      }
    },
    schemas: {
      RegisterRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', example: 'joseph@example1.com' },
          password: { type: 'string', example: 'password123' },
          displayName: { type: 'string', example: 'Joseph' }
        }
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', example: 'joseph@example1.com' },
          password: { type: 'string', example: 'password123' }
        }
      },
      AuthResponse: {
        type: 'object',
        properties: {
          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'usr_1723456789' },
              email: { type: 'string', example: 'joseph@example1.com' },
              displayName: { type: 'string', example: 'Joseph' }
            }
          }
        }
      },
      SaveSlotRequest: {
        type: 'object',
        required: ['weekStart', 'slotKey', 'plannedTask', 'actualTask'],
        properties: {
          weekStart: { type: 'string', example: '2026-08-10' },
          slotKey: { type: 'string', example: '2026-08-10_13:00' },
          plannedTask: { type: 'string', example: 'Lunch & Rest' },
          actualTask: { type: 'string', example: 'Lunch & Rest' },
          category: { type: 'string', example: 'Health' },
          status: { type: 'string', example: 'Done' },
          planned: { type: 'integer', example: 30 },
          actual: { type: 'integer', example: 30 },
          notes: { type: 'string', example: 'Healthy meal' }
        }
      },
      DeleteSlotRequest: {
        type: 'object',
        required: ['weekStart', 'slotKey'],
        properties: {
          weekStart: { type: 'string', example: '2026-08-10' },
          slotKey: { type: 'string', example: '2026-08-10_13:00' }
        }
      },
      LogHabitRequest: {
        type: 'object',
        required: ['weekStart', 'name'],
        properties: {
          weekStart: { type: 'string', example: '2026-08-10' },
          name: { type: 'string', example: 'Drink Water' },
          pts: { type: 'integer', example: 5 },
          notes: { type: 'string', example: 'Hydration log' }
        }
      },
      AddTodoRequest: {
        type: 'object',
        required: ['weekStart', 'text'],
        properties: {
          weekStart: { type: 'string', example: '2026-08-10' },
          text: { type: 'string', example: 'Review Weekly Goals' }
        }
      },
      ToggleTodoRequest: {
        type: 'object',
        required: ['completed'],
        properties: {
          completed: { type: 'boolean', example: true }
        }
      },
      SaveNotesRequest: {
        type: 'object',
        required: ['weekStart', 'notes'],
        properties: {
          weekStart: { type: 'string', example: '2026-08-10' },
          notes: { type: 'string', example: 'Weekly focus summary notes...' }
        }
      }
    }
  },
  paths: {
    '/health': {
      get: {
        summary: 'API Health Check Status',
        tags: ['System Health'],
        responses: {
          200: {
            description: 'API is online and functioning properly'
          }
        }
      }
    },
    '/auth/register': {
      post: {
        summary: 'Register New Account',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterRequest' }
            }
          }
        },
        responses: {
          200: {
            description: 'Registration successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' }
              }
            }
          },
          400: { description: 'Bad request or user already exists' }
        }
      }
    },
    '/auth/login': {
      post: {
        summary: 'User Login',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' }
            }
          }
        },
        responses: {
          200: {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' }
              }
            }
          },
          401: { description: 'Invalid email or password' }
        }
      }
    },
    '/auth/me': {
      get: {
        summary: 'Get Current User Profile',
        tags: ['Authentication'],
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Authenticated user profile details' },
          401: { description: 'Unauthorized' }
        }
      }
    },
    '/schedule/week/{weekStart}': {
      get: {
        summary: 'Fetch Weekly 30-Minute Schedule Slots',
        tags: ['Schedule Grid'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'weekStart',
            in: 'path',
            required: true,
            description: 'Monday ISO Date YYYY-MM-DD',
            schema: { type: 'string', example: '2026-08-10' }
          }
        ],
        responses: {
          200: { description: 'Weekly slot dictionary' },
          401: { description: 'Unauthorized' }
        }
      }
    },
    '/schedule/slot': {
      post: {
        summary: 'Save or Update a 30-Minute Time Slot',
        tags: ['Schedule Grid'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SaveSlotRequest' }
            }
          }
        },
        responses: {
          200: { description: 'Slot saved successfully' },
          401: { description: 'Unauthorized' }
        }
      },
      delete: {
        summary: 'Clear/Delete a 30-Minute Time Slot',
        tags: ['Schedule Grid'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DeleteSlotRequest' }
            }
          }
        },
        responses: {
          200: { description: 'Slot cleared successfully' },
          401: { description: 'Unauthorized' }
        }
      }
    },
    '/habits/week/{weekStart}': {
      get: {
        summary: 'Fetch Weekly Habit Logs',
        tags: ['Habit Ledger'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'weekStart',
            in: 'path',
            required: true,
            schema: { type: 'string', example: '2026-08-10' }
          }
        ],
        responses: {
          200: { description: 'List of logged habits' }
        }
      }
    },
    '/habits/log': {
      post: {
        summary: 'Log a Habit Entry',
        tags: ['Habit Ledger'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LogHabitRequest' }
            }
          }
        },
        responses: {
          200: { description: 'Habit logged successfully' }
        }
      }
    },
    '/habits/{id}': {
      delete: {
        summary: 'Delete Habit Log Entry',
        tags: ['Habit Ledger'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', example: '1723456789000' }
          }
        ],
        responses: {
          200: { description: 'Habit log removed' }
        }
      }
    },
    '/todos/week/{weekStart}': {
      get: {
        summary: 'Fetch Weekly Todos & Scratchpad Notes',
        tags: ['Todos & Notes'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'weekStart',
            in: 'path',
            required: true,
            schema: { type: 'string', example: '2026-08-10' }
          }
        ],
        responses: {
          200: { description: 'Weekly todos list and notes' }
        }
      }
    },
    '/todos/todo': {
      post: {
        summary: 'Add Todo Item',
        tags: ['Todos & Notes'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AddTodoRequest' }
            }
          }
        },
        responses: {
          200: { description: 'Todo item added' }
        }
      }
    },
    '/todos/{id}': {
      patch: {
        summary: 'Toggle Todo Completion Status',
        tags: ['Todos & Notes'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', example: 'c1f7a2b0-1234-5678-90ab-cdef12345678' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ToggleTodoRequest' }
            }
          }
        },
        responses: {
          200: { description: 'Todo updated successfully' }
        }
      },
      delete: {
        summary: 'Delete Todo Item',
        tags: ['Todos & Notes'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', example: 'c1f7a2b0-1234-5678-90ab-cdef12345678' }
          }
        ],
        responses: {
          200: { description: 'Todo item deleted' }
        }
      }
    },
    '/todos/notes': {
      post: {
        summary: 'Save Weekly Scratchpad Notes',
        tags: ['Todos & Notes'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SaveNotesRequest' }
            }
          }
        },
        responses: {
          200: { description: 'Notes updated successfully' }
        }
      }
    }
  }
};
