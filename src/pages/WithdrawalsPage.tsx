import { useWithdrawals } from '../api/hooks'
import { DataTable, Filter, filterInputClass, Pager, SortToggle, useListControls } from '../components/table'
import { Hex, Section } from '../components/ui'
import { decimalToHex, formatDate, formatUint, uintToDecimal } from '../lib/format'
import { useApp } from './AppLayout'

export function WithdrawalsPage() {
  const { searchParams, limit, offset, descending, update } = useListControls()
  const account = searchParams.get('account') ?? ''
  const { appParam } = useApp()

  const withdrawals = useWithdrawals(
    appParam,
    { account_index: account ? decimalToHex(account) : undefined },
    { limit, offset, descending },
  )

  return (
    <Section
      title="Withdrawals (post-foreclosure)"
      actions={
        <div className="flex items-center gap-3">
          <Filter label="Account index">
            <input
              type="number"
              min={0}
              value={account}
              onChange={(e) => update({ account: e.target.value })}
              placeholder="any"
              className={`${filterInputClass} w-24`}
            />
          </Filter>
          <SortToggle descending={descending} onChange={(desc) => update({ desc })} />
        </div>
      }
    >
      <DataTable
        columns={[
          { header: 'Account index', align: 'right', cell: (w) => formatUint(w.account_index) },
          { header: 'Account', cell: (w) => <Hex value={w.account} /> },
          { header: 'Output', cell: (w) => <Hex value={w.output} /> },
          { header: 'Block', align: 'right', cell: (w) => formatUint(w.block_number) },
          { header: 'Transaction', cell: (w) => <Hex value={w.transaction_hash} /> },
          { header: 'Observed', cell: (w) => formatDate(w.created_at) },
        ]}
        rows={withdrawals.data?.data}
        rowKey={(w) => w.account_index}
        rowLink={(w) => `/apps/${appParam}/withdrawals/${uintToDecimal(w.account_index)}`}
        isLoading={withdrawals.isLoading}
        error={withdrawals.error}
        empty="No withdrawals observed. Withdrawals only exist for foreclosed applications after the accounts drive has been proved."
      />
      <Pager
        pagination={withdrawals.data?.pagination}
        limit={limit}
        offset={offset}
        onChange={(next) => update(next)}
      />
    </Section>
  )
}
