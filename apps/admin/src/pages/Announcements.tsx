import AnnouncementManager from '../components/AnnouncementManager'
import { AdminPageShell, AdminPageHeader, AdminSection } from '../components/layout/Page'

export default function Announcements() {
  return (
    <AdminPageShell>
      <AdminPageHeader
        overline="Admin • Communications"
        title="Announcements"
        description="Create, schedule, and publish updates for your residents."
      />
      <AdminSection title="Announcement Manager" description="Draft, review, and publish announcements across the municipality." padding="md">
        <AnnouncementManager />
      </AdminSection>
    </AdminPageShell>
  )
}


