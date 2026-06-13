// src/components/PlaceholderPage.jsx
// Reusable placeholder for pages not yet built
export default function PlaceholderPage({ title, description, icon: Icon }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center space-y-4">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Icon className="text-primary" size={32} />
        </div>
      )}
      <h2 className="text-2xl font-bold text-foreground">{title}</h2>
      {description && <p className="text-muted-foreground max-w-sm">{description}</p>}
      <span className="text-xs text-muted-foreground/60 border border-border rounded-full px-3 py-1">
        Coming soon
      </span>
    </div>
  );
}
