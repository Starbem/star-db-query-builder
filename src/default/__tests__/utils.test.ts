import {
  createSelectFields,
  generatePlaceholders,
  generateSetClause,
  createWhereClause,
  createOrderByClause,
  createGroupByClause,
  createLimitClause,
  createOffsetClause,
} from '../utils'
import { Conditions } from '../types'

describe('Utils Functions', () => {
  describe('createSelectFields', () => {
    it('should return "*" when no fields are provided', () => {
      expect(createSelectFields([], 'pg')).toBe('*')
      expect(createSelectFields([], 'mysql')).toBe('*')
    })

    it('should return "*" when fields array is undefined', () => {
      expect(createSelectFields(undefined as any, 'pg')).toBe('*')
      expect(createSelectFields(undefined as any, 'mysql')).toBe('*')
    })

    it('should create comma-separated fields for PostgreSQL', () => {
      const fields = ['id', 'name', 'email']
      expect(createSelectFields(fields, 'pg')).toBe('id, name, email')
    })

    it('should create comma-separated fields for MySQL', () => {
      const fields = ['id', 'name', 'email']
      expect(createSelectFields(fields, 'mysql')).toBe('id, name, email')
    })

    it('should handle single field', () => {
      expect(createSelectFields(['id'], 'pg')).toBe('id')
      expect(createSelectFields(['id'], 'mysql')).toBe('id')
    })
  })

  describe('generatePlaceholders', () => {
    it('should generate PostgreSQL placeholders', () => {
      const keys = ['id', 'name', 'email']
      expect(generatePlaceholders(keys, 'pg')).toBe('$1, $2, $3')
    })

    it('should generate MySQL placeholders', () => {
      const keys = ['id', 'name', 'email']
      expect(generatePlaceholders(keys, 'mysql')).toBe('?, ?, ?')
    })

    it('should handle empty array', () => {
      expect(generatePlaceholders([], 'pg')).toBe('')
      expect(generatePlaceholders([], 'mysql')).toBe('')
    })

    it('should handle single key', () => {
      expect(generatePlaceholders(['id'], 'pg')).toBe('$1')
      expect(generatePlaceholders(['id'], 'mysql')).toBe('?')
    })
  })

  describe('generateSetClause', () => {
    it('should generate PostgreSQL SET clause', () => {
      const keys = ['id', 'name', 'email']
      expect(generateSetClause(keys, 'pg')).toBe(
        'id = $1, name = $2, email = $3'
      )
    })

    it('should generate MySQL SET clause', () => {
      const keys = ['id', 'name', 'email']
      expect(generateSetClause(keys, 'mysql')).toBe(
        'id = ?, name = ?, email = ?'
      )
    })

    it('should handle empty array', () => {
      expect(generateSetClause([], 'pg')).toBe('')
      expect(generateSetClause([], 'mysql')).toBe('')
    })

    it('should handle single key', () => {
      expect(generateSetClause(['id'], 'pg')).toBe('id = $1')
      expect(generateSetClause(['id'], 'mysql')).toBe('id = ?')
    })
  })

  describe('createWhereClause', () => {
    it('should return empty WHERE clause when no conditions provided', () => {
      const [clause, values, index] = createWhereClause({}, 1, 'pg')
      expect(clause).toBe('')
      expect(values).toEqual([])
      expect(index).toBe(1)
    })

    it('should create WHERE clause with simple equality condition for PostgreSQL', () => {
      const conditions: Conditions<any> = {
        status: { operator: '=', value: 'active' },
      }
      const [clause, values, index] = createWhereClause(conditions, 1, 'pg')
      expect(clause).toBe(' WHERE status = $1')
      expect(values).toEqual(['active'])
      expect(index).toBe(2)
    })

    it('should create WHERE clause with simple equality condition for MySQL', () => {
      const conditions: Conditions<any> = {
        status: { operator: '=', value: 'active' },
      }
      const [clause, values, index] = createWhereClause(conditions, 1, 'mysql')
      expect(clause).toBe(' WHERE status = ?')
      expect(values).toEqual(['active'])
      expect(index).toBe(2)
    })

    it('should handle multiple conditions', () => {
      const conditions: Conditions<any> = {
        status: { operator: '=', value: 'active' },
        email: { operator: 'ILIKE', value: '%example.com' },
      }
      const [clause, values, index] = createWhereClause(conditions, 1, 'pg')
      expect(clause).toBe(' WHERE status = $1 AND email ILIKE $2')
      expect(values).toEqual(['active', '%example.com'])
      expect(index).toBe(3)
    })

    it('should handle IN operator with array values', () => {
      const conditions: Conditions<any> = {
        status: { operator: 'IN', value: ['active', 'pending'] },
      }
      const [clause, values, index] = createWhereClause(conditions, 1, 'pg')
      expect(clause).toBe(' WHERE status IN ($1, $2)')
      expect(values).toEqual(['active', 'pending'])
      expect(index).toBe(3)
    })

    it('should handle BETWEEN operator', () => {
      const conditions: Conditions<any> = {
        created_at: {
          operator: 'BETWEEN',
          value: ['2023-01-01', '2023-12-31'],
        },
      }
      const [clause, values, index] = createWhereClause(conditions, 1, 'pg')
      expect(clause).toBe(' WHERE created_at BETWEEN $1 AND $2')
      expect(values).toEqual(['2023-01-01', '2023-12-31'])
      expect(index).toBe(3)
    })

    it('should handle IS NULL operator', () => {
      const conditions: Conditions<any> = {
        deleted_at: { operator: 'IS NULL', value: null },
      }
      const [clause, values, index] = createWhereClause(conditions, 1, 'pg')
      expect(clause).toBe(' WHERE deleted_at IS NULL')
      expect(values).toEqual([])
      expect(index).toBe(1)
    })

    it('should handle IS NOT NULL operator', () => {
      const conditions: Conditions<any> = {
        email: { operator: 'IS NOT NULL', value: null },
      }
      const [clause, values, index] = createWhereClause(conditions, 1, 'pg')
      expect(clause).toBe(' WHERE email IS NOT NULL')
      expect(values).toEqual([])
      expect(index).toBe(1)
    })

    it('should handle NOT EXISTS operator', () => {
      const conditions: Conditions<any> = {
        id: {
          operator: 'NOT EXISTS',
          value:
            'SELECT 1 FROM deleted_users WHERE deleted_users.id = users.id',
        },
      }
      const [clause, values, index] = createWhereClause(conditions, 1, 'pg')
      expect(clause).toBe(
        ' WHERE NOT EXISTS (SELECT 1 FROM deleted_users WHERE deleted_users.id = users.id)'
      )
      expect(values).toEqual([])
      expect(index).toBe(1)
    })

    it('should handle unaccent with ILIKE for PostgreSQL', () => {
      const conditions: Conditions<any> = {
        name: { operator: 'ILIKE', value: '%john%' },
      }
      const [clause, values, index] = createWhereClause(
        conditions,
        1,
        'pg',
        true
      )
      expect(clause).toBe(' WHERE unaccent(name::text) ILIKE unaccent($1)')
      expect(values).toEqual(['%john%'])
      expect(index).toBe(2)
    })

    it('should handle OR conditions', () => {
      const conditions: Conditions<any> = {
        OR: [
          { status: { operator: '=', value: 'active' } },
          { status: { operator: '=', value: 'pending' } },
        ],
      }
      const [clause, values, index] = createWhereClause(conditions, 1, 'pg')
      expect(clause).toBe(' WHERE (status = $1 OR status = $2)')
      expect(values).toEqual(['active', 'pending'])
      expect(index).toBe(3)
    })

    it('should handle AND conditions', () => {
      const conditions: Conditions<any> = {
        AND: [
          { status: { operator: '=', value: 'active' } },
          { email: { operator: 'ILIKE', value: '%example.com' } },
        ],
      }
      const [clause, values, index] = createWhereClause(conditions, 1, 'pg')
      expect(clause).toBe(' WHERE (status = $1 AND email ILIKE $2)')
      expect(values).toEqual(['active', '%example.com'])
      expect(index).toBe(3)
    })
  })

  describe('createOrderByClause', () => {
    it('should return empty string when no orderBy provided', () => {
      expect(createOrderByClause()).toBe('')
      expect(createOrderByClause(undefined)).toBe('')
    })

    it('should create ORDER BY clause with single field', () => {
      const orderBy = [{ field: 'created_at', direction: 'DESC' as const }]
      expect(createOrderByClause(orderBy)).toBe(' ORDER BY created_at DESC')
    })

    it('should create ORDER BY clause with multiple fields', () => {
      const orderBy = [
        { field: 'status', direction: 'ASC' as const },
        { field: 'created_at', direction: 'DESC' as const },
      ]
      expect(createOrderByClause(orderBy)).toBe(
        ' ORDER BY status ASC, created_at DESC'
      )
    })

    it('should handle empty array', () => {
      expect(createOrderByClause([])).toBe('')
    })
  })

  describe('createGroupByClause', () => {
    it('should return empty string when no groupBy provided', () => {
      expect(createGroupByClause()).toBe('')
      expect(createGroupByClause(undefined)).toBe('')
    })

    it('should create GROUP BY clause with single field', () => {
      const groupBy = ['status']
      expect(createGroupByClause(groupBy)).toBe(' GROUP BY status')
    })

    it('should create GROUP BY clause with multiple fields', () => {
      const groupBy = ['status', 'created_at']
      expect(createGroupByClause(groupBy)).toBe(' GROUP BY status, created_at')
    })

    it('should handle empty array', () => {
      expect(createGroupByClause([])).toBe('')
    })
  })

  describe('createLimitClause', () => {
    it('should return empty string when no limit provided', () => {
      expect(createLimitClause()).toBe('')
      expect(createLimitClause(undefined)).toBe('')
    })

    it('should create LIMIT clause', () => {
      expect(createLimitClause(10)).toBe(' LIMIT 10')
      expect(createLimitClause(100)).toBe(' LIMIT 100')
    })

    it('should handle zero limit', () => {
      expect(createLimitClause(0)).toBe('')
    })
  })

  describe('createOffsetClause', () => {
    it('should return empty string when no offset provided', () => {
      expect(createOffsetClause()).toBe('')
      expect(createOffsetClause(undefined)).toBe('')
    })

    it('should create OFFSET clause', () => {
      expect(createOffsetClause(10)).toBe(' OFFSET 10')
      expect(createOffsetClause(100)).toBe(' OFFSET 100')
    })

    it('should handle zero offset', () => {
      expect(createOffsetClause(0)).toBe('')
    })
  })
})
