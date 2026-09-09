/**
 * Utilitários para processamento e compressão de fotos de pets
 */

export const BREED_PHOTO_PRESETS = [
  {
    label: "Yorkshire",
    breed: "Yorkshire Terrier",
    url: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=300&auto=format&fit=crop&q=80",
  },
  {
    label: "Pastor",
    breed: "Pastor Canadense",
    url: "https://images.unsplash.com/photo-1568572933382-74d440642117?w=300&auto=format&fit=crop&q=80",
  },
  {
    label: "Golden",
    breed: "Golden Retriever",
    url: "https://images.unsplash.com/photo-1552053831-71594a27632d?w=300&auto=format&fit=crop&q=80",
  },
  {
    label: "Poodle",
    breed: "Poodle",
    url: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=300&auto=format&fit=crop&q=80",
  },
  {
    label: "Buldogue",
    breed: "Buldogue",
    url: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=300&auto=format&fit=crop&q=80",
  },
  {
    label: "Shih-tzu",
    breed: "Shih-tzu",
    url: "https://images.unsplash.com/photo-1541364983171-a8ba01e95cfc?w=300&auto=format&fit=crop&q=80",
  },
  {
    label: "Caramelo",
    breed: "SRD (Vira-lata)",
    url: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=300&auto=format&fit=crop&q=80",
  },
  {
    label: "Gato",
    breed: "Felino",
    url: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=300&auto=format&fit=crop&q=80",
  },
];

/**
 * Comprime uma imagem selecionada pelo usuário no navegador para no máximo 500x500px,
 * otimizando o peso para ~30KB em base64 e garantindo carregamento instantâneo.
 */
export async function compressImageFile(
  file: File,
  maxDimension = 500,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("O arquivo selecionado não é uma imagem válida."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo de imagem."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Falha ao processar a imagem."));
      img.onload = () => {
        let { width, height } = img;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
