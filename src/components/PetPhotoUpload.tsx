import { useRef, useState } from "react";
import { Camera, Image as ImageIcon, Link as LinkIcon, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PetAvatar } from "@/components/PetAvatar";
import { BREED_PHOTO_PRESETS, compressImageFile } from "@/lib/imageUtils";
import { cn } from "@/lib/utils";

interface PetPhotoUploadProps {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  petName?: string;
  species?: string;
  className?: string;
}

export function PetPhotoUpload({
  value,
  onChange,
  petName,
  species,
  className,
}: PetPhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [showPresets, setShowPresets] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const compressed = await compressImageFile(file, 500, 0.82);
      onChange(compressed);
      toast.success("Foto do pet selecionada com sucesso!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao processar imagem");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleApplyUrl() {
    const trimmed = urlDraft.trim();
    if (!trimmed) {
      setShowUrlInput(false);
      return;
    }
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.startsWith("data:image")) {
      toast.error("Insira uma URL de imagem válida (http:// ou https://)");
      return;
    }
    onChange(trimmed);
    setUrlDraft("");
    setShowUrlInput(false);
    toast.success("Link da foto aplicado!");
  }

  return (
    <div className={cn("rounded-2xl border border-border/80 bg-card p-3.5 space-y-3", className)}>
      <div className="flex items-center gap-3.5">
        {/* Avatar Preview */}
        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <PetAvatar
            photoUrl={value}
            name={petName}
            species={species}
            size="xl"
            className="ring-2 ring-primary/20 transition group-hover:scale-105"
          />
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white">
            <Camera className="h-5 w-5" />
          </div>
          {isProcessing && (
            <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center text-white">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </div>
          )}
        </div>

        {/* Informações e Botões Principais */}
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5 text-primary" />
            Foto do Pet
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Adicione uma foto real para identificação visual no Kanban, carteira de vacinas e agendamento.
          </p>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="h-7 px-2.5 text-xs font-semibold rounded-lg gap-1 shadow-xs"
            >
              <Upload className="h-3.5 w-3.5 text-primary" />
              {value ? "Trocar Foto" : "Carregar Foto"}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowPresets(!showPresets)}
              className="h-7 px-2 text-xs font-semibold rounded-lg gap-1"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Sugestões
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              title="Colar link web"
            >
              <LinkIcon className="h-3.5 w-3.5" />
            </Button>

            {value && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onChange(null)}
                className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                title="Remover foto"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Input de URL Direta */}
      {showUrlInput && (
        <div className="flex items-center gap-2 pt-2 border-t border-border/60 animate-in fade-in duration-200">
          <Input
            placeholder="Cole o link da foto (https://...)"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            className="h-8 text-xs rounded-lg"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleApplyUrl}
            className="h-8 px-3 text-xs font-bold rounded-lg shrink-0"
          >
            Aplicar
          </Button>
        </div>
      )}

      {/* Sugestões Rápidas por Raça */}
      {showPresets && (
        <div className="pt-2 border-t border-border/60 space-y-1.5 animate-in fade-in duration-200">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
            Escolha rápida por raça comum:
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
            {BREED_PHOTO_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  onChange(p.url);
                  setShowPresets(false);
                  toast.success(`Foto de ${p.label} selecionada!`);
                }}
                className="flex flex-col items-center gap-1 p-1 rounded-xl hover:bg-muted transition group border border-transparent hover:border-primary/30"
              >
                <img
                  src={p.url}
                  alt={p.label}
                  className="h-9 w-9 rounded-full object-cover border border-primary/20 group-hover:scale-105 transition"
                />
                <span className="text-[9px] font-semibold text-muted-foreground truncate w-full text-center">
                  {p.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
