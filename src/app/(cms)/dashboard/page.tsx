import React from 'react';
import { requireAuthPage } from '@/features/auth/require-auth';
import { CmsShell } from '@/components/cms/layout/CmsShell';
import { DashboardView } from '@/components/cms/dashboard/DashboardView';
import { getDashboardData } from '@/features/dashboard/dashboard.service';

export default async function DashboardPage() {
  const session = await requireAuthPage();
  const data = await getDashboardData();

  return (
    <CmsShell>
      <DashboardView data={data} userName={session.name} />
    </CmsShell>
  );
}

export const dynamic = 'force-dynamic';
