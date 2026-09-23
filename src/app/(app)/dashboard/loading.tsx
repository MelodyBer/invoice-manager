export default function DashboardLoading(): React.JSX.Element {
    return <div role="status" className="space-y-5"><p className="text-lg">טוענת את תמונת המצב של העסק…</p><div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(item => <div key={item} className="h-36 rounded-2xl bg-foreground/5 motion-safe:animate-pulse" />)}</div></div>;
}
