import React from 'react';
import Card from '@/components/ui/Card';

export default function StudentCard({ title, value, description }) {
  return (
    <Card>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <h3 className="mt-2 text-3xl font-semibold text-slate-900">{value}</h3>
      {description ? <p className="mt-2 text-sm text-slate-500">{description}</p> : null}
    </Card>
  );
}
