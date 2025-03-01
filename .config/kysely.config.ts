import { defineConfig } from 'kysely-ctl'
import { dialect, plugins } from '../app/data/db'

export default defineConfig({
  dialect,
  plugins,
})
