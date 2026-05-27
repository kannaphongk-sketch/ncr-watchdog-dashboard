import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MessageSquare, Shield, Calendar, Plus, Trash2, Pencil, Check, X } from "lucide-react";

// ─── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="mt-0.5 p-1.5 rounded-md bg-primary/10">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

// ─── Reply Template Editor ─────────────────────────────────────────────────────
function ReplyTemplateEditor() {
  const utils = trpc.useUtils();
  const { data: templates = [], isLoading } = trpc.replyTemplates.list.useQuery();
  const createMut = trpc.replyTemplates.create.useMutation({
    onSuccess: () => { utils.replyTemplates.list.invalidate(); toast.success("Template added"); setNewTemplate(""); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.replyTemplates.update.useMutation({
    onSuccess: () => { utils.replyTemplates.list.invalidate(); toast.success("Template updated"); setEditingId(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.replyTemplates.delete.useMutation({
    onSuccess: () => { utils.replyTemplates.list.invalidate(); toast.success("Template deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const [newTemplate, setNewTemplate] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const startEdit = (id: number, text: string) => { setEditingId(id); setEditText(text); };
  const cancelEdit = () => { setEditingId(null); setEditText(""); };

  return (
    <section className="rounded-xl border border-border/50 bg-card p-5 mb-6">
      <SectionHeader icon={MessageSquare} title="Reply Templates" sub="Auto-reply messages sent when appreciative comments are detected" />
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-2 mb-4">
          {templates.map((t) => (
            <div key={t.id} className="flex items-start gap-2 rounded-lg border border-border/40 bg-muted/20 p-3">
              {editingId === t.id ? (
                <>
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="flex-1 text-sm min-h-[60px]"
                    maxLength={500}
                  />
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500" onClick={() => updateMut.mutate({ id: t.id, template: editText })}>
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={cancelEdit}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground/90 leading-relaxed">{t.template}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch
                      checked={t.isActive}
                      onCheckedChange={(v) => updateMut.mutate({ id: t.id, isActive: v })}
                      className="scale-75"
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => startEdit(t.id, t.template)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive/70 hover:text-destructive" onClick={() => deleteMut.mutate({ id: t.id })}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Textarea
          placeholder="Add new reply template..."
          value={newTemplate}
          onChange={(e) => setNewTemplate(e.target.value)}
          className="flex-1 text-sm min-h-[60px]"
          maxLength={500}
        />
        <Button
          size="sm"
          className="shrink-0 self-end"
          disabled={!newTemplate.trim() || createMut.isPending}
          onClick={() => createMut.mutate({ template: newTemplate.trim() })}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add
        </Button>
      </div>
      <p className="text-xs text-muted-foreground/60 mt-2">{templates.length} templates · {templates.filter(t => t.isActive).length} active</p>
    </section>
  );
}

// ─── Toxic Keyword Blacklist Editor ───────────────────────────────────────────
const CATEGORIES = ["spam", "profanity", "gambling", "political"] as const;
type Category = typeof CATEGORIES[number];

const CATEGORY_COLORS: Record<Category, string> = {
  spam: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  profanity: "bg-red-500/15 text-red-600 border-red-500/30",
  gambling: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  political: "bg-purple-500/15 text-purple-600 border-purple-500/30",
};

function ToxicKeywordEditor() {
  const utils = trpc.useUtils();
  const { data: keywords = [], isLoading } = trpc.toxicKeywords.list.useQuery();
  const createMut = trpc.toxicKeywords.create.useMutation({
    onSuccess: () => { utils.toxicKeywords.list.invalidate(); toast.success("Keyword added"); setNewKeyword(""); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.toxicKeywords.update.useMutation({
    onSuccess: () => { utils.toxicKeywords.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.toxicKeywords.delete.useMutation({
    onSuccess: () => { utils.toxicKeywords.list.invalidate(); toast.success("Keyword removed"); },
    onError: (e) => toast.error(e.message),
  });

  const [newKeyword, setNewKeyword] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("spam");
  const [filterCat, setFilterCat] = useState<Category | "all">("all");

  const filtered = filterCat === "all" ? keywords : keywords.filter(k => k.category === filterCat);

  return (
    <section className="rounded-xl border border-border/50 bg-card p-5 mb-6">
      <SectionHeader icon={Shield} title="Toxic Keyword Blacklist" sub="Comments containing these keywords will be auto-hidden or flagged" />

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {(["all", ...CATEGORIES] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              filterCat === cat
                ? "bg-primary text-primary-foreground"
                : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {cat === "all" ? `All (${keywords.length})` : `${cat} (${keywords.filter(k => k.category === cat).length})`}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : (
        <div className="flex flex-wrap gap-2 mb-4 min-h-[40px]">
          {filtered.map((k) => (
            <div
              key={k.id}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity ${
                CATEGORY_COLORS[k.category as Category] ?? "bg-muted/40 text-muted-foreground border-border/40"
              } ${!k.isActive ? "opacity-40" : ""}`}
            >
              <span>{k.keyword}</span>
              <button
                onClick={() => updateMut.mutate({ id: k.id, isActive: !k.isActive })}
                className="opacity-60 hover:opacity-100 transition-opacity"
                title={k.isActive ? "Disable" : "Enable"}
              >
                {k.isActive ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
              </button>
              <button
                onClick={() => deleteMut.mutate({ id: k.id })}
                className="opacity-60 hover:opacity-100 text-destructive transition-opacity"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground/60">No keywords in this category.</p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          placeholder="New keyword..."
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          className="flex-1 text-sm h-9"
          maxLength={255}
          onKeyDown={(e) => e.key === "Enter" && newKeyword.trim() && createMut.mutate({ keyword: newKeyword.trim(), category: newCategory })}
        />
        <Select value={newCategory} onValueChange={(v) => setNewCategory(v as Category)}>
          <SelectTrigger className="w-[110px] h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="shrink-0 h-9"
          disabled={!newKeyword.trim() || createMut.isPending}
          onClick={() => createMut.mutate({ keyword: newKeyword.trim(), category: newCategory })}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add
        </Button>
      </div>
    </section>
  );
}

// ─── Personal Agenda Editor ────────────────────────────────────────────────────
function AgendaEditor() {
  const utils = trpc.useUtils();
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const { data: agenda } = trpc.agenda.get.useQuery({ date: selectedDate });
  const [content, setContent] = useState("");
  const saveMut = trpc.agenda.save.useMutation({
    onSuccess: () => { utils.agenda.get.invalidate(); toast.success("Agenda saved — will appear in tomorrow's Morning Brief"); },
    onError: (e) => toast.error(e.message),
  });

  // Sync content when agenda data loads
  const agendaContent = agenda?.content ?? "";

  return (
    <section className="rounded-xl border border-border/50 bg-card p-5 mb-6">
      <SectionHeader icon={Calendar} title="Personal Agenda" sub="Daily notes included in the 07:30 Morning Brief Telegram message" />
      <div className="flex gap-2 mb-3">
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => { setSelectedDate(e.target.value); setContent(""); }}
          className="w-[160px] text-sm h-9"
        />
        <span className="text-xs text-muted-foreground self-center">{selectedDate === today ? "Today" : ""}</span>
      </div>
      <Textarea
        placeholder="Enter your agenda for this day... (will be included in Morning Brief)"
        value={content || agendaContent}
        onChange={(e) => setContent(e.target.value)}
        className="text-sm min-h-[100px] mb-3"
        maxLength={2000}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground/60">
          {(content || agendaContent).length}/2000 characters
        </p>
        <Button
          size="sm"
          disabled={saveMut.isPending}
          onClick={() => saveMut.mutate({ date: selectedDate, content: content || agendaContent })}
        >
          Save Agenda
        </Button>
      </div>
    </section>
  );
}

// ─── Main Settings Page ────────────────────────────────────────────────────────
export default function Settings() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure Facebook automation, reply templates, and daily agenda</p>
        </div>
        <ReplyTemplateEditor />
        <ToxicKeywordEditor />
        <AgendaEditor />
      </div>
    </div>
  );
}
