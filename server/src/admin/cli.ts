/**
 * DayFlow Administrative & DevOps Operations CLI (Phase 1)
 * 
 * Secure, zero-HTTP-attack-surface CLI for server operators and DevOps engineers.
 * Executed directly on the host via:
 *   npm run admin -- <command> [options]
 * 
 * Strict Privacy Guarantee:
 * - Administrators have access to account metadata and aggregated record counts.
 * - Private task descriptions, markdown notes, and habit reflections are strictly protected.
 */
import bcrypt from 'bcryptjs';
import { executeQuery, pool } from '../db/db.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function printBanner() {
  console.log('\n================================================================');
  console.log('   🛡️  DAYFLOW DEVOPS & ADMINISTRATIVE CLI (v2.10.0)');
  console.log('   Zero-Attack-Surface Operations • Strict User Privacy');
  console.log('================================================================\n');
}

function printHelp() {
  printBanner();
  console.log('Usage: npm run admin -- <command> [arguments]\n');
  console.log('Commands:');
  console.log('  stats                         Display system health, user counts, and database storage metrics');
  console.log('  users [limit=50]              List registered users with status, provider, and creation date');
  console.log('  user <email|id>               Inspect detailed account metadata and aggregated record counts');
  console.log('  disable <email|id>            Suspend user account and immediately invalidate all active sessions');
  console.log('  enable <email|id>             Reactivate a suspended user account');
  console.log('  reset-password <email|id> <pw> Safely update user password and revoke all prior sessions');
  console.log('  delete-user <email|id> --confirm Permanently purge user and cascade-delete all related data (GDPR)');
  console.log('\nExamples:');
  console.log('  npm run admin -- stats');
  console.log('  npm run admin -- users 20');
  console.log('  npm run admin -- user test@example.com');
  console.log('  npm run admin -- disable user@domain.com');
  console.log('  npm run admin -- enable user@domain.com');
  console.log('  npm run admin -- reset-password user@domain.com "NewSecurePass123"');
  console.log('  npm run admin -- delete-user badactor@spam.com --confirm\n');
}

async function findUser(identifier: string) {
  const clean = identifier.trim().toLowerCase();
  let query = 'SELECT * FROM users WHERE LOWER(email) = $1';
  let params: any[] = [clean];

  if (UUID_REGEX.test(clean)) {
    query = 'SELECT * FROM users WHERE id = $1 OR LOWER(email) = $2';
    params = [clean, clean];
  }

  const result = await executeQuery(query, params);
  return result.rows[0] || null;
}

// 1. Stats Command
async function handleStats() {
  printBanner();
  console.log('📊 Fetching DayFlow Platform Telemetry & Metrics...\n');

  try {
    // Database size
    const dbSizeRes = await executeQuery("SELECT pg_size_pretty(pg_database_size(current_database())) as size;");
    const dbSize = dbSizeRes.rows[0]?.size || 'Unknown';

    // Users breakdown
    const usersRes = await executeQuery(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE is_disabled = false)::int as active,
        COUNT(*) FILTER (WHERE is_disabled = true)::int as suspended,
        COUNT(*) FILTER (WHERE google_id IS NOT NULL)::int as google_users,
        COUNT(*) FILTER (WHERE password_hash IS NOT NULL)::int as password_users
      FROM users;
    `);
    const uStats = usersRes.rows[0];

    // Data table counts
    const weeksRes = await executeQuery("SELECT COUNT(*)::int as count FROM schedule_weeks;");
    const slotsRes = await executeQuery("SELECT COUNT(*)::int as count, COUNT(*) FILTER (WHERE is_productive = true)::int as productive FROM schedule_slots;");
    const habitsRes = await executeQuery("SELECT COUNT(*)::int as count FROM habit_logs;");
    const todosRes = await executeQuery("SELECT COUNT(*)::int as count, COUNT(*) FILTER (WHERE is_completed = true)::int as completed FROM todo_items;");
    const categoriesRes = await executeQuery("SELECT COUNT(*)::int as count FROM user_categories;");
    const templatesRes = await executeQuery("SELECT COUNT(*)::int as count FROM user_day_templates;");

    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log(`│ Database Storage Footprint:  ${dbSize.padEnd(30)} │`);
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log(`│ Total Registered Users:      ${String(uStats.total).padEnd(30)} │`);
    console.log(`│  • Active Accounts:          ${String(uStats.active).padEnd(30)} │`);
    console.log(`│  • Suspended Accounts:       ${String(uStats.suspended).padEnd(30)} │`);
    console.log(`│  • Google Auth Users:        ${String(uStats.google_users).padEnd(30)} │`);
    console.log(`│  • Password Auth Users:      ${String(uStats.password_users).padEnd(30)} │`);
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log(`│ Productivity Records Ledger:                                │`);
    console.log(`│  • Schedule Weeks:           ${String(weeksRes.rows[0].count).padEnd(30)} │`);
    console.log(`│  • Schedule Slots:           ${String(slotsRes.rows[0].count).padEnd(14)} (${slotsRes.rows[0].productive} productive) │`);
    console.log(`│  • Habit Logs:               ${String(habitsRes.rows[0].count).padEnd(30)} │`);
    console.log(`│  • Todo Items:               ${String(todosRes.rows[0].count).padEnd(14)} (${todosRes.rows[0].completed} completed)  │`);
    console.log(`│  • Custom Categories:        ${String(categoriesRes.rows[0].count).padEnd(30)} │`);
    console.log(`│  • Day Templates:            ${String(templatesRes.rows[0].count).padEnd(30)} │`);
    console.log('└─────────────────────────────────────────────────────────────┘\n');
  } catch (err: any) {
    console.error('❌ Failed to fetch database stats:', err.message);
  }
}

// 2. Users List Command
async function handleListUsers(limitStr?: string) {
  printBanner();
  const limit = Math.max(1, Math.min(200, parseInt(limitStr || '50', 10) || 50));
  console.log(`👥 Registered Users (Limit: ${limit}):\n`);

  try {
    const result = await executeQuery(`
      SELECT id, email, display_name, google_id, password_hash, is_disabled, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT $1;
    `, [limit]);

    if (result.rows.length === 0) {
      console.log('No registered users found in the database.\n');
      return;
    }

    console.log('ID                                   | Email                          | Status    | Provider | Created');
    console.log('-------------------------------------+--------------------------------+-----------+----------+------------');
    for (const row of result.rows) {
      const id = row.id;
      const email = (row.email || '').padEnd(30).substring(0, 30);
      const status = row.is_disabled ? 'SUSPENDED ' : 'ACTIVE    ';
      let provider = 'Password';
      if (row.google_id && row.password_hash) provider = 'Both    ';
      else if (row.google_id) provider = 'Google  ';
      else provider = 'Password';
      const created = row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : 'N/A';
      console.log(`${id} | ${email} | ${status} | ${provider} | ${created}`);
    }
    console.log(`\nTotal displayed: ${result.rows.length}\n`);
  } catch (err: any) {
    console.error('❌ Failed to list users:', err.message);
  }
}

// 3. User Inspection Command
async function handleInspectUser(identifier?: string) {
  printBanner();
  if (!identifier) {
    console.error('❌ Error: User email or UUID is required.');
    console.log('Usage: npm run admin -- user <email|id>\n');
    return;
  }

  try {
    const user = await findUser(identifier);
    if (!user) {
      console.error(`❌ User not found for identifier: "${identifier}"\n`);
      return;
    }

    // Record counts for user
    const [weeks, slots, habits, todos, cats, tmpls] = await Promise.all([
      executeQuery('SELECT COUNT(*)::int as c FROM schedule_weeks WHERE user_id = $1;', [user.id]),
      executeQuery('SELECT COUNT(*)::int as c, COUNT(*) FILTER (WHERE is_productive = true)::int as p FROM schedule_slots WHERE week_id IN (SELECT id FROM schedule_weeks WHERE user_id = $1);', [user.id]),
      executeQuery('SELECT COUNT(*)::int as c FROM habit_logs WHERE user_id = $1;', [user.id]),
      executeQuery('SELECT COUNT(*)::int as c, COUNT(*) FILTER (WHERE is_completed = true)::int as comp FROM todo_items WHERE week_id IN (SELECT id FROM schedule_weeks WHERE user_id = $1);', [user.id]),
      executeQuery('SELECT COUNT(*)::int as c, COUNT(*) FILTER (WHERE is_archived = true)::int as arch FROM user_categories WHERE user_id = $1;', [user.id]),
      executeQuery('SELECT COUNT(*)::int as c FROM user_day_templates WHERE user_id = $1;', [user.id])
    ]);

    console.log(`Account Overview for: ${user.email}`);
    console.log('-------------------------------------------------------------');
    console.log(`User ID:           ${user.id}`);
    console.log(`Email Address:     ${user.email}`);
    console.log(`Display Name:      ${user.display_name || 'N/A'}`);
    console.log(`Account Status:    ${user.is_disabled ? '🔴 SUSPENDED (Login Blocked)' : '🟢 ACTIVE'}`);
    console.log(`Auth Providers:    ${user.google_id ? 'Google OAuth' : ''} ${user.password_hash ? 'Password' : ''}`);
    console.log(`Session Version:   v${user.token_version ?? 1}`);
    console.log(`Registration Date: ${user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}`);
    console.log('-------------------------------------------------------------');
    console.log('Aggregated Data Footprint:');
    console.log(`• Schedule Weeks:   ${weeks.rows[0].c}`);
    console.log(`• Schedule Slots:   ${slots.rows[0].c} (${slots.rows[0].p} marked productive)`);
    console.log(`• Habit Logs:       ${habits.rows[0].c}`);
    console.log(`• Todo Items:       ${todos.rows[0].c} (${todos.rows[0].comp} completed)`);
    console.log(`• Categories:       ${cats.rows[0].c} (${cats.rows[0].arch} archived)`);
    console.log(`• Day Templates:    ${tmpls.rows[0].c}`);
    console.log('-------------------------------------------------------------');
    console.log('🔒 Privacy Protection: Private task text, notes, and habit descriptions are omitted.\n');
  } catch (err: any) {
    console.error('❌ Failed to inspect user:', err.message);
  }
}

// 4. Disable Account Command
async function handleDisableUser(identifier?: string) {
  printBanner();
  if (!identifier) {
    console.error('❌ Error: User email or UUID is required.');
    console.log('Usage: npm run admin -- disable <email|id>\n');
    return;
  }

  try {
    const user = await findUser(identifier);
    if (!user) {
      console.error(`❌ User not found for identifier: "${identifier}"\n`);
      return;
    }

    if (user.is_disabled) {
      console.log(`ℹ️ User ${user.email} is ALREADY suspended.\n`);
      return;
    }

    // Disable account and bump token_version to invalidate all active JWTs
    await executeQuery(
      'UPDATE users SET is_disabled = true, token_version = token_version + 1 WHERE id = $1',
      [user.id]
    );

    console.log(`✅ User account "${user.email}" (${user.id}) has been SUSPENDED.`);
    console.log('🔒 All active JWT sessions have been immediately invalidated.');
    console.log('   The user will be denied access on all subsequent API requests.\n');
  } catch (err: any) {
    console.error('❌ Failed to disable user:', err.message);
  }
}

// 5. Enable Account Command
async function handleEnableUser(identifier?: string) {
  printBanner();
  if (!identifier) {
    console.error('❌ Error: User email or UUID is required.');
    console.log('Usage: npm run admin -- enable <email|id>\n');
    return;
  }

  try {
    const user = await findUser(identifier);
    if (!user) {
      console.error(`❌ User not found for identifier: "${identifier}"\n`);
      return;
    }

    if (!user.is_disabled) {
      console.log(`ℹ️ User ${user.email} is ALREADY active.\n`);
      return;
    }

    await executeQuery('UPDATE users SET is_disabled = false WHERE id = $1', [user.id]);
    console.log(`✅ User account "${user.email}" (${user.id}) has been REACTIVATED.`);
    console.log('   The user can now sign in normally.\n');
  } catch (err: any) {
    console.error('❌ Failed to enable user:', err.message);
  }
}

// 6. Reset Password Command
async function handleResetPassword(identifier?: string, newPassword?: string) {
  printBanner();
  if (!identifier || !newPassword) {
    console.error('❌ Error: Both user identifier and new password are required.');
    console.log('Usage: npm run admin -- reset-password <email|id> <newPassword>\n');
    return;
  }

  if (newPassword.length < 6 || newPassword.length > 72) {
    console.error('❌ Error: Password must be between 6 and 72 characters long.\n');
    return;
  }

  try {
    const user = await findUser(identifier);
    if (!user) {
      console.error(`❌ User not found for identifier: "${identifier}"\n`);
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update password hash and bump token version to invalidate prior sessions
    await executeQuery(
      'UPDATE users SET password_hash = $1, token_version = token_version + 1 WHERE id = $2',
      [passwordHash, user.id]
    );

    console.log(`✅ Password successfully updated for user "${user.email}".`);
    console.log('🔒 All prior sessions have been invalidated.');
    console.log('   The user can now log in using the new password.\n');
  } catch (err: any) {
    console.error('❌ Failed to reset password:', err.message);
  }
}

// 7. Delete User Command (GDPR Purge)
async function handleDeleteUser(identifier?: string, confirmFlag?: string) {
  printBanner();
  if (!identifier) {
    console.error('❌ Error: User email or UUID is required.');
    console.log('Usage: npm run admin -- delete-user <email|id> --confirm\n');
    return;
  }

  if (confirmFlag !== '--confirm') {
    console.error('⚠️  SAFETY WARNING: Permanent account and data deletion requested.');
    console.error(`   User identifier: "${identifier}"`);
    console.error('   This operation is IRREVERSIBLE. It will permanently purge:');
    console.error('   • The user profile account');
    console.error('   • All schedule weeks and slots');
    console.error('   • All habit completion logs');
    console.error('   • All checklist todo items');
    console.error('   • All custom categories and day templates');
    console.error('\n   To execute this deletion, you must explicitly pass the --confirm flag:');
    console.error(`   npm run admin -- delete-user ${identifier} --confirm\n`);
    return;
  }

  try {
    const user = await findUser(identifier);
    if (!user) {
      console.error(`❌ User not found for identifier: "${identifier}"\n`);
      return;
    }

    // PostgreSQL ON DELETE CASCADE handles schedule_weeks, habits, categories, templates, etc.
    await executeQuery('DELETE FROM users WHERE id = $1', [user.id]);

    console.log(`✅ User account "${user.email}" (${user.id}) has been PERMANENTLY PURGED.`);
    console.log('   All cascading schedule records, habits, todos, and categories have been deleted.');
    console.log('   GDPR / Right-to-be-forgotten compliance fulfilled.\n');
  } catch (err: any) {
    console.error('❌ Failed to purge user:', err.message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = (args[0] || '').toLowerCase().trim();

  try {
    switch (command) {
      case 'stats':
        await handleStats();
        break;
      case 'users':
      case 'list':
        await handleListUsers(args[1]);
        break;
      case 'user':
      case 'inspect':
        await handleInspectUser(args[1]);
        break;
      case 'disable':
      case 'suspend':
      case 'ban':
        await handleDisableUser(args[1]);
        break;
      case 'enable':
      case 'activate':
      case 'unban':
        await handleEnableUser(args[1]);
        break;
      case 'reset-password':
      case 'password':
        await handleResetPassword(args[1], args[2]);
        break;
      case 'delete-user':
      case 'purge':
        await handleDeleteUser(args[1], args[2]);
        break;
      case 'help':
      case '--help':
      case '-h':
      case '':
        printHelp();
        break;
      default:
        console.error(`\n❌ Unknown command: "${command}"`);
        printHelp();
        process.exitCode = 1;
        break;
    }
  } catch (e: any) {
    console.error('❌ Fatal error executing admin CLI:', e.message);
    process.exitCode = 1;
  } finally {
    // Gracefully close pool so CLI process exits immediately
    await pool.end();
  }
}

main();
