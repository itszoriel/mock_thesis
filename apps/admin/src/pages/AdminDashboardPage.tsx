import { useState, useEffect } from 'react'
import { dashboardApi } from '../lib/api'
import UserVerificationList from '../components/UserVerificationList'
import IssueManagement from '../components/IssueManagement'
import AnnouncementManager from '../components/AnnouncementManager'
import AdminHeader from '../components/AdminHeader'
import { StatCard, Card } from '@munlink/ui'

export default function AdminDashboardPage() {
  const [dashboardStats, setDashboardStats] = useState({
    pending_verifications: 0,
    active_issues: 0,
    marketplace_items: 0,
    announcements: 0
  })
  const [loading, setLoading] = useState(true)
  

  // Load dashboard statistics
  const loadDashboardStats = async () => {
    try {
      setLoading(true)
      const response = await dashboardApi.getDashboardStats()
      // Some endpoints return raw object (no data wrapper). Support both.
      const stats = (response as any)?.data ?? response
      if (stats && typeof stats === 'object') {
        setDashboardStats(stats as any)
      } else {
        // Defensive default
        setDashboardStats({
          pending_verifications: 0,
          active_issues: 0,
          marketplace_items: 0,
          announcements: 0,
        })
      }
    } catch (err: any) {
      // Handle 422 errors gracefully - show default stats instead of error
      if (err.response?.status === 422) {
        setDashboardStats({
          pending_verifications: 0,
          active_issues: 0,
          marketplace_items: 0,
          announcements: 0
        })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardStats()
  }, [])

  const handleUserVerified = (_userId: number) => {
    // Refresh stats when user is verified
    loadDashboardStats()
  }

  const handleUserRejected = (_userId: number) => {
    // Refresh stats when user is rejected
    loadDashboardStats()
  }

  const handleIssueUpdated = (_issueId: number) => {
    // Refresh stats when issue is updated
    loadDashboardStats()
  }

  const handleAnnouncementUpdated = (_announcementId: number) => {
    // Refresh stats when announcement is updated
    loadDashboardStats()
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-ocean-50 to-white">
      {/* Header */}
      <AdminHeader />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard title="Pending Verifications" value={loading ? '…' : dashboardStats.pending_verifications} />
          <StatCard title="Active Issues" value={loading ? '…' : dashboardStats.active_issues} />
          <StatCard title="Marketplace Items" value={loading ? '…' : dashboardStats.marketplace_items} />
          <StatCard title="Announcements" value={loading ? '…' : dashboardStats.announcements} />
        </div>

        {/* Management Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Verification Management */}
          <Card title={<span className="text-xl">Pending User Verifications</span>} subtitle="Review and approve user registrations">
            <UserVerificationList 
              onUserVerified={handleUserVerified}
              onUserRejected={handleUserRejected}
            />
          </Card>

          {/* Announcements Management */}
          <Card title={<span className="text-xl">Announcements</span>} subtitle="Create and manage public announcements">
            <AnnouncementManager onAnnouncementUpdated={handleAnnouncementUpdated} />
          </Card>

          {/* Marketplace section removed as listings go live immediately. Consider replacing with a read-only Recent Listings widget. */}

          {/* Issue Tracking */}
          <Card title={<span className="text-xl">Reported Issues</span>} subtitle="Track and respond to community issues">
            <IssueManagement onIssueUpdated={handleIssueUpdated} />
          </Card>
        </div>
      </main>
    </div>
  )
}

