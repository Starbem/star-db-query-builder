import {
  createSelectFields,
  generatePlaceholders,
  generateSetClause,
  createWhereClause,
  createOrderByClause,
  createGroupByClause,
  createLimitClause,
  createOffsetClause,
  assertValidIdentifier,
  assertSafeSqlFragment,
} from '../utils'

describe('utils', () => {
  describe('assertValidIdentifier', () => {
    it('accepts a plain identifier', () => {
      expect(() => assertValidIdentifier('users', 'table name')).not.toThrow()
    })

    it('accepts a schema/table-qualified identifier', () => {
      expect(() =>
        assertValidIdentifier('users.id', 'table name')
      ).not.toThrow()
    })

    it('rejects an identifier with a stacked query', () => {
      expect(() =>
        assertValidIdentifier('users; DROP TABLE users; --', 'table name')
      ).toThrow(/Invalid table name/)
    })

    it('rejects an identifier with quotes or spaces', () => {
      expect(() =>
        assertValidIdentifier("users' OR '1'='1", 'table name')
      ).toThrow(/Invalid table name/)
    })
  })

  describe('assertSafeSqlFragment', () => {
    it('accepts a plain expression with functions and aliases', () => {
      expect(() =>
        assertSafeSqlFragment('COUNT(*) as total', 'select field')
      ).not.toThrow()
    })

    it('rejects a fragment with a statement terminator', () => {
      expect(() =>
        assertSafeSqlFragment('id; DROP TABLE users;', 'select field')
      ).toThrow(/Invalid select field/)
    })

    it('rejects a fragment with a comment marker', () => {
      expect(() =>
        assertSafeSqlFragment('id -- comment', 'select field')
      ).toThrow(/Invalid select field/)
    })
  })

  describe('createSelectFields', () => {
    it('returns * when no fields provided', () => {
      expect(createSelectFields(undefined, 'pg')).toBe('*')
      expect(createSelectFields([], 'pg')).toBe('*')
    })

    it('joins provided fields with comma', () => {
      expect(createSelectFields(['id', 'name', 'email'], 'pg')).toBe(
        'id, name, email'
      )
    })

    it('allows aggregate/expression fields as documented', () => {
      expect(
        createSelectFields(['status', 'COUNT(*) as count'], 'pg')
      ).toBe('status, COUNT(*) as count')
    })

    it('throws when a field contains a stacked query', () => {
      expect(() =>
        createSelectFields(['id; DROP TABLE users; --'], 'pg')
      ).toThrow(/Invalid select field/)
    })
  })

  describe('generatePlaceholders', () => {
    it('generates numbered placeholders for pg', () => {
      expect(generatePlaceholders(['id', 'name', 'email'], 'pg')).toBe(
        '$1, $2, $3'
      )
    })

    it('generates ? placeholders for mysql', () => {
      expect(generatePlaceholders(['id', 'name', 'email'], 'mysql')).toBe(
        '?, ?, ?'
      )
    })
  })

  describe('generateSetClause', () => {
    it('generates SET clause with numbered placeholders for pg', () => {
      expect(generateSetClause(['name', 'email'], 'pg')).toBe(
        'name = $1, email = $2'
      )
    })

    it('generates SET clause with ? placeholders for mysql', () => {
      expect(generateSetClause(['name', 'email'], 'mysql')).toBe(
        'name = ?, email = ?'
      )
    })
  })

  describe('createWhereClause', () => {
    it('returns empty clause when no conditions provided', () => {
      const [clause, values] = createWhereClause({}, 1, 'pg')
      expect(clause).toBe('')
      expect(values).toEqual([])
    })

    it('builds a simple equality condition for pg', () => {
      const [clause, values] = createWhereClause(
        { status: { operator: '=', value: 'active' } },
        1,
        'pg'
      )
      expect(clause).toBe(' WHERE status = $1')
      expect(values).toEqual(['active'])
    })

    it('builds a simple equality condition for mysql', () => {
      const [clause, values] = createWhereClause(
        { status: { operator: '=', value: 'active' } },
        1,
        'mysql'
      )
      expect(clause).toBe(' WHERE status = ?')
      expect(values).toEqual(['active'])
    })

    it('increments placeholder index across multiple conditions', () => {
      const [clause, values] = createWhereClause(
        {
          status: { operator: '=', value: 'active' },
          name: { operator: 'ILIKE', value: '%john%' },
        },
        1,
        'pg'
      )
      expect(clause).toBe(' WHERE status = $1 AND name ILIKE $2')
      expect(values).toEqual(['active', '%john%'])
    })

    it('handles IN operator with array value', () => {
      const [clause, values] = createWhereClause(
        { id: { operator: 'IN', value: ['1', '2', '3'] } },
        1,
        'pg'
      )
      expect(clause).toBe(' WHERE id IN ($1, $2, $3)')
      expect(values).toEqual(['1', '2', '3'])
    })

    it('handles BETWEEN operator with array value', () => {
      const [clause, values] = createWhereClause(
        { created_at: { operator: 'BETWEEN', value: ['2023-01-01', '2023-12-31'] } },
        1,
        'pg'
      )
      expect(clause).toBe(' WHERE created_at BETWEEN $1 AND $2')
      expect(values).toEqual(['2023-01-01', '2023-12-31'])
    })

    it('handles IS NULL / IS NOT NULL without consuming a placeholder', () => {
      const [clause, values] = createWhereClause(
        { deleted_at: { operator: 'IS NULL', value: null } },
        1,
        'pg'
      )
      expect(clause).toBe(' WHERE deleted_at IS NULL')
      expect(values).toEqual([])
    })

    it('handles NOT EXISTS with a raw subquery string', () => {
      const [clause] = createWhereClause(
        {
          notExists: {
            operator: 'NOT EXISTS',
            value: 'SELECT 1 FROM orders WHERE orders.user_id = users.id',
          },
        } as any,
        1,
        'pg'
      )
      expect(clause).toBe(
        ' WHERE NOT EXISTS (SELECT 1 FROM orders WHERE orders.user_id = users.id)'
      )
    })

    it('applies unaccent wrapper for ILIKE on pg when unaccent flag is set', () => {
      const [clause, values] = createWhereClause(
        { name: { operator: 'ILIKE', value: '%joao%' } },
        1,
        'pg',
        true
      )
      expect(clause).toBe(
        ' WHERE unaccent(name::text) ILIKE unaccent($1)'
      )
      expect(values).toEqual(['%joao%'])
    })

    it('does not apply unaccent for mysql even when flag is set', () => {
      const [clause] = createWhereClause(
        { name: { operator: 'ILIKE', value: '%joao%' } },
        1,
        'mysql',
        true
      )
      expect(clause).toBe(' WHERE name ILIKE ?')
    })

    it('combines OR conditions into a single group', () => {
      const [clause, values] = createWhereClause(
        {
          OR: [
            { status: { operator: '=', value: 'active' } },
            { status: { operator: '=', value: 'pending' } },
          ],
        } as any,
        1,
        'pg'
      )
      expect(clause).toBe(' WHERE (status = $1 OR status = $2)')
      expect(values).toEqual(['active', 'pending'])
    })

    it('combines AND conditions into a single group', () => {
      const [clause, values] = createWhereClause(
        {
          AND: [
            { status: { operator: '=', value: 'active' } },
            { role: { operator: '=', value: 'admin' } },
          ],
        } as any,
        1,
        'pg'
      )
      expect(clause).toBe(' WHERE (status = $1 AND role = $2)')
      expect(values).toEqual(['active', 'admin'])
    })

    it('starts placeholder numbering from the given startIndex', () => {
      const [clause, values] = createWhereClause(
        { status: { operator: '=', value: 'active' } },
        3,
        'pg'
      )
      expect(clause).toBe(' WHERE status = $3')
      expect(values).toEqual(['active'])
    })
  })

  describe('createOrderByClause', () => {
    it('returns empty string when no orderBy provided', () => {
      expect(createOrderByClause(undefined)).toBe('')
      expect(createOrderByClause([])).toBe('')
    })

    it('builds ORDER BY clause from fields', () => {
      expect(
        createOrderByClause([{ field: 'created_at', direction: 'DESC' }])
      ).toBe(' ORDER BY created_at DESC')
    })

    it('joins multiple fields with comma', () => {
      expect(
        createOrderByClause([
          { field: 'status', direction: 'ASC' },
          { field: 'created_at', direction: 'DESC' },
        ])
      ).toBe(' ORDER BY status ASC, created_at DESC')
    })

    it('throws when direction is not ASC or DESC', () => {
      expect(() =>
        createOrderByClause([
          { field: 'created_at', direction: 'DESC; DROP TABLE users' as any },
        ])
      ).toThrow(/Invalid orderBy direction/)
    })

    it('throws when field contains a stacked query', () => {
      expect(() =>
        createOrderByClause([
          { field: 'created_at; DROP TABLE users; --', direction: 'DESC' },
        ])
      ).toThrow(/Invalid orderBy field/)
    })
  })

  describe('createGroupByClause', () => {
    it('returns empty string when no groupBy provided', () => {
      expect(createGroupByClause(undefined)).toBe('')
      expect(createGroupByClause([])).toBe('')
    })

    it('builds GROUP BY clause from fields', () => {
      expect(createGroupByClause(['status'])).toBe(' GROUP BY status')
    })

    it('throws when a field contains a stacked query', () => {
      expect(() =>
        createGroupByClause(['status; DROP TABLE users; --'])
      ).toThrow(/Invalid groupBy field/)
    })
  })

  describe('createLimitClause', () => {
    it('returns empty string when no limit provided', () => {
      expect(createLimitClause(undefined)).toBe('')
      expect(createLimitClause(0)).toBe('')
    })

    it('builds LIMIT clause', () => {
      expect(createLimitClause(10)).toBe(' LIMIT 10')
    })
  })

  describe('createOffsetClause', () => {
    it('returns empty string when no offset provided', () => {
      expect(createOffsetClause(undefined)).toBe('')
      expect(createOffsetClause(0)).toBe('')
    })

    it('builds OFFSET clause', () => {
      expect(createOffsetClause(20)).toBe(' OFFSET 20')
    })
  })
})
