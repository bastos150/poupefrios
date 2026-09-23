import { useState, useRef, useCallback } from 'react';
import { Camera, X, Upload, Loader2, ImageIcon, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';

interface PhotoCaptureProps {
  onPhotoUploaded: (url: string) => void;
  photoUrl: string | null;
  onClear: () => void;
}

export function PhotoCapture({ onPhotoUploaded, photoUrl, onClear }: PhotoCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      setStream(mediaStream);
      setShowCamera(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch (err) {
      setError('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    setShowCamera(false);
  }, [stream]);

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const ext = file.type.split('/')[1] || 'jpg';
      const fileName = `evidencia_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('evidencias')
        .upload(fileName, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('evidencias')
        .getPublicUrl(fileName);

      onPhotoUploaded(urlData.publicUrl);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar foto.');
    } finally {
      setUploading(false);
    }
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `evidencia_${Date.now()}.jpg`, { type: 'image/jpeg' });
        uploadFile(file);
        stopCamera();
      },
      'image/jpeg',
      0.85
    );
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  async function handleDelete() {
    if (!photoUrl) return;
    try {
      const fileName = photoUrl.split('/').pop();
      if (fileName) {
        await supabase.storage.from('evidencias').remove([fileName]);
      }
    } catch {
      // ignore deletion errors
    }
    onClear();
  }

  if (photoUrl) {
    return (
      <div className="space-y-2">
        <label className="sp-label">Foto da evidência</label>
        <div className="relative rounded-lg border border-slate-200 overflow-hidden">
          <img src={photoUrl} alt="Evidência" className="w-full h-40 object-cover" />
          <button
            type="button"
            onClick={handleDelete}
            className="absolute top-2 right-2 rounded-full bg-red-600 p-1.5 text-white shadow-lg hover:bg-red-700"
          >
            <X size={16} />
          </button>
        </div>
        <Button
          type="button"
          variant="danger"
          size="sm"
          className="w-full"
          icon={<Trash2 size={16} />}
          onClick={handleDelete}
        >
          Excluir foto
        </Button>
      </div>
    );
  }

  if (showCamera) {
    return (
      <div className="space-y-3">
        <label className="sp-label">Tirar foto da evidência</label>
        <div className="relative rounded-lg overflow-hidden bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-64 object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
        </div>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="flex-1"
            icon={<Camera size={20} />}
            onClick={capturePhoto}
            disabled={uploading}
          >
            {uploading ? 'Enviando...' : 'Capturar'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            icon={<X size={20} />}
            onClick={stopCamera}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="sp-label">Foto da evidência (opcional)</label>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="md"
          className="flex-1"
          icon={uploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
          onClick={startCamera}
          disabled={uploading}
        >
          {uploading ? 'Enviando...' : 'Tirar Foto'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="md"
          className="flex-1"
          icon={uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Enviando...' : 'Galeria'}
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />
      {!photoUrl && (
        <p className="text-xs text-slate-400 flex items-center gap-1">
          <ImageIcon size={12} />
          Tire uma foto do equipamento ou produto para registrar a evidência.
        </p>
      )}
    </div>
  );
}
