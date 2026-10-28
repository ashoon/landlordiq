import { useState, useEffect } from 'react'
import Header from './components/layout/Header.jsx'
import SummaryStrip from './components/layout/SummaryStrip.jsx'
import Dashboard from './components/dashboard/Dashboard.jsx'
import Analytics from './components/analytics/Analytics.jsx'
import SyncBanner from './components/layout/SyncBanner.jsx'
import { getMonthKey, importSeedUnits } from './data/tenants.js'
import { subscribe } from './data/store.js'
import { initDriveSync } from './data/driveSync.js'
import { ensureTrackingStart } from './data/tracking.js'

// Hash routing (#/analytics) so deep links and refreshes work on static hosts such as GitHub Pages
function getTabFromPath() {
  return window.location.hash.toLowerCase().startsWith('#/analytics') ? 'analytics' : 'dashboard'
}

/**
 * App — top-level shell. Owns the active tab/route state and renders the correct view.
 */
export default function App() {
  const [activeTab, setActiveTab] = useState(getTabFromPath)
  // Incremented when a unit toggle occurs so SummaryStrip re-reads from tenants.js
  const [statsKey, setStatsKey] = useState(0)
  // Selected month ('YYYY-MM') shared by the dashboard and analytics views
  const [selectedMonth, setSelectedMonth] = useState(() => getMonthKey())
  // Bumped when data arrives from Google Drive or another tab, remounting the views so they re-read it
  const [dataKey, setDataKey] = useState(0)

  useEffect(() => {
    // One-time import of the starting tenant list (dev machine only); re-read the views if it ran
    const seedUnits = () => importSeedUnits().then((imported) => imported && setDataKey((k) => k + 1))

    initDriveSync()
    // After sync is wired up, so changes made here count as local changes and are uploaded
    ensureTrackingStart()
    seedUnits()
    return subscribe((source) => {
      if (source !== 'remote') return
      setDataKey((k) => k + 1)
      // A Drive copy saved before tracking began has no start month; set it once the import finishes
      setTimeout(ensureTrackingStart, 0)
      // A Drive copy saved before the tenant list was imported needs the import again
      setTimeout(seedUnits, 0)
    })
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getTabFromPath())
    }
    window.addEventListener('hashchange', handlePopState)
    return () => window.removeEventListener('hashchange', handlePopState)
  }, [])

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    const targetHash = tab === 'analytics' ? '#/analytics' : '#/'
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header
        activeTab={activeTab}
        onTabChange={handleTabChange}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
      />
      <SyncBanner />
      {activeTab === 'dashboard' && <SummaryStrip key={`summary-${dataKey}`} refreshKey={statsKey} month={selectedMonth} />}
      <main key={`main-${dataKey}`} className="flex-1">
        {activeTab === 'dashboard' ? (
          <Dashboard month={selectedMonth} onStatsChange={() => setStatsKey((k) => k + 1)} />
        ) : (
          <Analytics refreshKey={statsKey} month={selectedMonth} />
        )}
      </main>
    </div>
  )
}
