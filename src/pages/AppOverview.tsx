import { Link } from 'react-router-dom'
import { useLastAcceptedEpochIndex, useProcessedInputCount } from '../api/hooks'
import { Collapsible, Hex, JsonView, KV, Section, StatusBadge } from '../components/ui'
import { formatDate, formatNanos, formatUint, isZeroHex } from '../lib/format'
import { useApp } from './AppLayout'

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-800">{value}</div>
    </div>
  )
}

export function AppOverview() {
  const { appParam, application: app } = useApp()
  const processedCount = useProcessedInputCount(appParam)
  const lastAccepted = useLastAcceptedEpochIndex(appParam)
  const foreclosed = !isZeroHex(app.foreclose_block)
  const driveProved = !isZeroHex(app.accounts_drive_proved_block)
  const withdrawalConfigured = !isZeroHex(app.withdrawal_config?.guardian)
  const ep = app.execution_parameters

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Processed inputs" value={formatUint(processedCount.data?.data)} />
        <StatCard
          label="Last accepted epoch"
          value={lastAccepted.isSuccess ? formatUint(lastAccepted.data.data) : '—'}
        />
        <StatCard label="Epoch length" value={formatUint(app.epoch_length)} />
        <StatCard label="Claim staging period" value={formatUint(app.claim_staging_period)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Contracts">
          <KV
            rows={[
              ['Application', <Hex value={app.iapplication_address} full />],
              ['Consensus', <Hex value={app.iconsensus_address} full />],
              ['Input box', <Hex value={app.iinputbox_address} full />],
              ['Template hash', <Hex value={app.template_hash} />],
              ['Data availability', <Hex value={app.data_availability} />],
              ['Input box deployed at block', formatUint(app.iinputbox_block)],
            ]}
          />
        </Section>

        <Section title="Status">
          <KV
            rows={[
              ['Status', <StatusBadge status={app.status} />],
              ['Consensus type', <StatusBadge status={app.consensus_type} />],
              ['Enabled', app.enabled ? 'yes' : 'no'],
              app.reason ? (['Reason', app.reason] as [React.ReactNode, React.ReactNode]) : null,
              ['Created', formatDate(app.created_at)],
              ['Updated', formatDate(app.updated_at)],
            ]}
          />
        </Section>

        <Section title="Sync checkpoints (last scanned block)">
          <KV
            rows={[
              ['Epochs', formatUint(app.last_epoch_check_block)],
              ['Inputs', formatUint(app.last_input_check_block)],
              ['Outputs', formatUint(app.last_output_check_block)],
              ['Tournaments', formatUint(app.last_tournament_check_block)],
              ['Foreclosure', formatUint(app.last_foreclose_check_block)],
              foreclosed
                ? ['Accounts drive proved', formatUint(app.last_accounts_drive_proved_check_block)]
                : null,
              driveProved ? ['Withdrawals', formatUint(app.last_withdrawal_check_block)] : null,
            ]}
          />
        </Section>

        <Section title="Foreclosure">
          {foreclosed ? (
            <KV
              rows={[
                ['Foreclosed at block', formatUint(app.foreclose_block)],
                ['Foreclosure tx', <Hex value={app.foreclose_transaction} />],
                [
                  'Accounts drive proved',
                  driveProved ? `block ${formatUint(app.accounts_drive_proved_block)}` : 'not yet',
                ],
                driveProved
                  ? ['Drive proved tx', <Hex value={app.accounts_drive_proved_transaction} />]
                  : null,
                driveProved
                  ? ['Accounts drive merkle root', <Hex value={app.accounts_drive_merkle_root} />]
                  : null,
                [
                  'Withdrawals',
                  <Link className="text-sky-700 hover:underline" to={`/apps/${appParam}/withdrawals`}>
                    browse withdrawals →
                  </Link>,
                ],
              ]}
            />
          ) : (
            <p className="text-sm text-slate-500">Not foreclosed.</p>
          )}
        </Section>

        <Section title="Withdrawal config">
          {withdrawalConfigured ? (
            <KV
              rows={[
                ['Guardian', <Hex value={app.withdrawal_config.guardian} full />],
                [
                  'Output builder',
                  <Hex value={app.withdrawal_config.withdrawal_output_builder} full />,
                ],
                [
                  'log2 leaves / account',
                  formatUint(app.withdrawal_config.log2_leaves_per_account),
                ],
                [
                  'log2 max accounts',
                  formatUint(app.withdrawal_config.log2_max_num_of_accounts),
                ],
                [
                  'Accounts drive start index',
                  formatUint(app.withdrawal_config.accounts_drive_start_index),
                ],
              ]}
            />
          ) : (
            <p className="text-sm text-slate-500">
              Not configured — this application cannot be foreclosed.
            </p>
          )}
        </Section>

        <Section title="Execution parameters">
          {ep ? (
            <KV
              rows={[
                ['Snapshot policy', <StatusBadge status={ep.snapshot_policy} />],
                ['Advance cycles (inc / max)', `${formatUint(ep.advance_inc_cycles)} / ${formatUint(ep.advance_max_cycles)}`],
                ['Inspect cycles (inc / max)', `${formatUint(ep.inspect_inc_cycles)} / ${formatUint(ep.inspect_max_cycles)}`],
                ['Advance deadline (inc / max)', `${formatNanos(ep.advance_inc_deadline)} / ${formatNanos(ep.advance_max_deadline)}`],
                ['Inspect deadline (inc / max)', `${formatNanos(ep.inspect_inc_deadline)} / ${formatNanos(ep.inspect_max_deadline)}`],
                ['Load / store deadline', `${formatNanos(ep.load_deadline)} / ${formatNanos(ep.store_deadline)}`],
                ['Fast deadline', formatNanos(ep.fast_deadline)],
                ['Max concurrent inspects', ep.max_concurrent_inspects],
              ]}
            />
          ) : (
            <p className="text-sm text-slate-500">Not available.</p>
          )}
        </Section>
      </div>

      <Collapsible label="Raw JSON">
        <JsonView value={app} />
      </Collapsible>
    </div>
  )
}
