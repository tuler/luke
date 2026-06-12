import { useParams } from 'react-router-dom'
import { useWithdrawal } from '../api/hooks'
import { PayloadView } from '../components/PayloadView'
import { Collapsible, Crumbs, ErrorBox, Hex, JsonView, KV, Section, Spinner } from '../components/ui'
import { decimalToHex, formatDate, formatUint } from '../lib/format'
import { useApp } from './AppLayout'

export function WithdrawalPage() {
  const { appParam } = useApp()
  const { accountIndex = '0' } = useParams()
  const withdrawal = useWithdrawal(appParam, decimalToHex(accountIndex))

  if (withdrawal.isLoading) return <Spinner />
  if (withdrawal.error) return <ErrorBox error={withdrawal.error} />
  const w = withdrawal.data!.data
  const base = `/apps/${appParam}`

  return (
    <div className="space-y-4">
      <Crumbs
        items={[
          { label: 'Withdrawals', to: `${base}/withdrawals` },
          { label: `Account ${formatUint(w.account_index)}` },
        ]}
      />

      <Section title={`Withdrawal — account ${formatUint(w.account_index)}`}>
        <KV
          rows={[
            ['Account index', formatUint(w.account_index)],
            ['Block number', formatUint(w.block_number)],
            ['Transaction', <Hex value={w.transaction_hash} full />],
            ['Log index', formatUint(w.log_index)],
            ['Observed', formatDate(w.created_at)],
          ]}
        />
      </Section>

      <Section title="Account (raw bytes — encoding defined by the WithdrawalOutputBuilder)">
        <PayloadView value={w.account} />
      </Section>

      <Section title="Output (raw bytes)">
        <PayloadView value={w.output} />
      </Section>

      <Collapsible label="Raw JSON">
        <JsonView value={w} />
      </Collapsible>
    </div>
  )
}
