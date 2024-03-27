import { PoolConfig as PgPoolConfig } from 'pg'
import { PoolOptions as MySqlPoolOptions } from 'mysql2'

// Configs
export * from './src/db/initDb'

// Generic Repository
export * from './src/default/genericRepository'

// Types Definition
export type { PgPoolConfig, MySqlPoolOptions }
