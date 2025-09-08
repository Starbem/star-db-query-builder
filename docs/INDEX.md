# Star DB Query Builder - Documentation Index

Welcome to the comprehensive documentation for the Star DB Query Builder library. This index provides quick access to all available documentation.

## 📚 Main Documentation

- **[README.md](./README.md)** - Complete library overview, installation, and quick start guide
- **[Raw Query Examples](./raw-query-examples.md)** - Detailed examples for raw SQL queries

## 🔧 Method Documentation

### Query Methods

- **[findFirst](./methods/findFirst.md)** - Find a single record with conditions
- **[findMany](./methods/findMany.md)** - Find multiple records with pagination and filtering

### Insert Methods

- **[insert](./methods/insert.md)** - Insert a single record
- **[insertMany](./methods/insertMany.md)** - Insert multiple records in batch

### Update Methods

- **[update](./methods/update.md)** - Update a single record by ID
- **[updateMany](./methods/updateMany.md)** - Update multiple records with conditions

### Delete Methods

- **[deleteOne](./methods/deleteOne.md)** - Delete a single record by ID
- **[deleteMany](./methods/deleteMany.md)** - Delete multiple records by IDs

### Advanced Methods

- **[joins](./methods/joins.md)** - Execute queries with JOIN operations
- **[rawQuery](./methods/rawQuery.md)** - Execute raw SQL queries

### Database Initialization

- **[initDb](./methods/initDb.md)** - Initialize database connections
- **[getDbClient](./methods/getDbClient.md)** - Retrieve database client instances

## 🏗️ Architecture Documentation

### Core Components

- **[Types and Interfaces](./architecture/types.md)** - TypeScript type definitions
- **[Database Clients](./architecture/database-clients.md)** - PostgreSQL and MySQL client implementations
- **[Query Builder](./architecture/query-builder.md)** - Internal query building logic

### Utilities

- **[Utils](./architecture/utils.md)** - Helper functions for query construction
- **[Error Handling](./architecture/error-handling.md)** - Error handling patterns and best practices

## 📖 Guides and Tutorials

### Getting Started

- **[Installation Guide](./guides/installation.md)** - Step-by-step installation instructions
- **[First Steps](./guides/first-steps.md)** - Your first database operations
- **[TypeScript Setup](./guides/typescript-setup.md)** - TypeScript configuration and usage

### Advanced Topics

- **[Performance Optimization](./guides/performance.md)** - Tips for optimizing database performance
- **[Security Best Practices](./guides/security.md)** - Security considerations and best practices
- **[Testing](./guides/testing.md)** - How to test your database operations
- **[Migration Guide](./guides/migration.md)** - Migrating from other ORMs

### Database-Specific Guides

- **[PostgreSQL Guide](./guides/postgresql.md)** - PostgreSQL-specific features and optimizations
- **[MySQL Guide](./guides/mysql.md)** - MySQL-specific features and optimizations

## 🎯 Use Cases and Examples

### Common Patterns

- **[User Management](./examples/user-management.md)** - Complete user CRUD operations
- **[E-commerce](./examples/ecommerce.md)** - Product catalog and order management
- **[Content Management](./examples/cms.md)** - Blog posts and content management
- **[Analytics](./examples/analytics.md)** - Data aggregation and reporting

### Real-World Scenarios

- **[API Development](./examples/api-development.md)** - Building REST APIs with the library
- **[Data Import/Export](./examples/data-import-export.md)** - Bulk data operations
- **[Audit Logging](./examples/audit-logging.md)** - Implementing audit trails
- **[Multi-tenant Applications](./examples/multi-tenant.md)** - Multi-tenant database patterns

## 🔍 Reference

### API Reference

- **[Method Signatures](./reference/method-signatures.md)** - Complete method signatures and parameters
- **[Type Definitions](./reference/type-definitions.md)** - All TypeScript interfaces and types
- **[Error Codes](./reference/error-codes.md)** - Complete list of error codes and messages

### Database Compatibility

- **[PostgreSQL Features](./reference/postgresql-features.md)** - PostgreSQL-specific features
- **[MySQL Features](./reference/mysql-features.md)** - MySQL-specific features
- **[SQL Generation](./reference/sql-generation.md)** - Examples of generated SQL queries

## 🚀 Quick Navigation

### By Task

- **Need to find data?** → [findFirst](./methods/findFirst.md) | [findMany](./methods/findMany.md)
- **Need to insert data?** → [insert](./methods/insert.md) | [insertMany](./methods/insertMany.md)
- **Need to update data?** → [update](./methods/update.md) | [updateMany](./methods/updateMany.md)
- **Need to delete data?** → [deleteOne](./methods/deleteOne.md) | [deleteMany](./methods/deleteMany.md)
- **Need complex queries?** → [joins](./methods/joins.md) | [rawQuery](./methods/rawQuery.md)

### By Experience Level

- **New to the library?** → [README.md](./README.md) → [First Steps](./guides/first-steps.md)
- **Familiar with basics?** → [Method Documentation](./methods/) → [Examples](./examples/)
- **Advanced user?** → [Architecture](./architecture/) → [Performance Guide](./guides/performance.md)

### By Database

- **Using PostgreSQL?** → [PostgreSQL Guide](./guides/postgresql.md) → [PostgreSQL Features](./reference/postgresql-features.md)
- **Using MySQL?** → [MySQL Guide](./guides/mysql.md) → [MySQL Features](./reference/mysql-features.md)

## 📝 Contributing to Documentation

If you find any issues with the documentation or want to contribute improvements:

1. Check the [Contributing Guidelines](../CONTRIBUTING.md)
2. Follow the [Documentation Style Guide](./style-guide.md)
3. Submit a pull request with your changes

## 🆘 Getting Help

- **Issues**: Check the [GitHub Issues](https://github.com/starbemtech/star-db-query-builder/issues)
- **Discussions**: Join the [GitHub Discussions](https://github.com/starbemtech/star-db-query-builder/discussions)
- **Examples**: Browse the [Examples](./examples/) directory
- **API Reference**: Check the [Reference](./reference/) section

---

**Last Updated**: September 2025  
**Version**: 1.2.0  
**Maintainer**: Starbem Tech Team
