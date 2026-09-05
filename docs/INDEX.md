# Star DB Query Builder - Documentation Index

Welcome to the documentation for the Star DB Query Builder library. This index links only to docs that actually exist in this repo — see [Contributing](#-contributing-to-documentation) if you want to add the rest.

## 📚 Main Documentation

- **[README.md](../README.md)** - Complete library overview, installation, and quick start guide
- **[ARCHITECTURE.md](../ARCHITECTURE.md)** - Internal architecture overview
- **[CHANGELOG.md](../CHANGELOG.md)** - Version history

## 🔧 Method Documentation

### Query Methods

- **[findFirst](./methods/findFirst.md)** - Find a single record with conditions
- **[findMany](./methods/findMany.md)** - Find multiple records with offset/limit pagination and filtering
- **[findManyCursor](./methods/findManyCursor.md)** - Find multiple records with keyset/cursor pagination (added 2026-09-04)

### Insert Methods

- **[insert](./methods/insert.md)** - Insert a single record
- **[insertMany](./methods/insertMany.md)** - Insert multiple records in batch
- **[upsert](./methods/upsert.md)** - Insert, or update in place on conflict (added 2026-09-04)

### Advanced Methods

- **[joins](./methods/joins.md)** - Execute queries with JOIN operations
- **[rawQuery](./methods/rawQuery.md)** - Execute raw SQL queries
- **[transactions](./methods/transactions.md)** - `withTransaction` / `beginTransaction`

## 🚀 Quick Navigation

### By Task

- **Need to find data?** → [findFirst](./methods/findFirst.md) | [findMany](./methods/findMany.md) | [findManyCursor](./methods/findManyCursor.md)
- **Need to insert data?** → [insert](./methods/insert.md) | [insertMany](./methods/insertMany.md) | [upsert](./methods/upsert.md)
- **Need complex queries?** → [joins](./methods/joins.md) | [rawQuery](./methods/rawQuery.md)
- **Need atomicity across operations?** → [transactions](./methods/transactions.md)

## 📝 Not documented here yet

These functions are exported and covered by tests but have no dedicated file in `docs/methods/` — check `src/core/repository.ts` and the JSDoc above each function, or `README.md`, in the meantime:

- `update` / `updateMany`
- `deleteOne` / `deleteMany`
- `initDb` / `getDbClient` / `closeDb` / `closeAllDbClients` / `resetDbClients`

## 📝 Contributing to Documentation

If you find any issues with the documentation or want to contribute improvements, submit a pull request. There is no separate style guide or CONTRIBUTING.md in this repo yet — follow the structure of the existing files in `docs/methods/`.

## 🆘 Getting Help

- **Repo**: `libs/star-db-query-builder` (Starbem code workspace)
- **Issues/PRs**: via the repo's GitHub remote (`git+https://github.com/starbem/star-db-query-builder.git`)

---

**Last Updated**: 2026-09-04
**Version**: 1.3.1
**Maintainer**: Starbem Tech Team
