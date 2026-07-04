import type { MemberWalletCardData } from "./member-wallet-card-data";

const WIDTH = 716;
const HEIGHT = 440;

const COLORS = {
  bgTop: "#1c1914",
  bgMid: "#0a0a0a",
  bgBottom: "#12100c",
  accent: "#c9b896",
  foreground: "#f5f2eb",
  muted: "#8a8680",
  border: "rgba(255,255,255,0.08)",
  active: "#6ee7b7",
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCardBackground(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, COLORS.bgTop);
  gradient.addColorStop(0.45, COLORS.bgMid);
  gradient.addColorStop(1, COLORS.bgBottom);
  ctx.fillStyle = gradient;
  roundRect(ctx, 0, 0, WIDTH, HEIGHT, 32);
  ctx.fill();

  const shine = ctx.createLinearGradient(0, 0, WIDTH * 0.6, HEIGHT);
  shine.addColorStop(0, "rgba(201, 184, 150, 0.12)");
  shine.addColorStop(0.35, "rgba(201, 184, 150, 0.03)");
  shine.addColorStop(1, "rgba(201, 184, 150, 0)");
  ctx.fillStyle = shine;
  roundRect(ctx, 0, 0, WIDTH, HEIGHT, 32);
  ctx.fill();

  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 2;
  roundRect(ctx, 1, 1, WIDTH - 2, HEIGHT - 2, 31);
  ctx.stroke();
}

export function drawMemberWalletCard(
  ctx: CanvasRenderingContext2D,
  data: MemberWalletCardData,
): void {
  drawCardBackground(ctx);

  const padX = 48;
  let y = 52;

  ctx.fillStyle = COLORS.accent;
  ctx.font = "500 22px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(`✦ ${data.brandName}`, padX, y);

  if (data.isActive) {
    const badge = "ACTIVE";
    ctx.font = "600 18px system-ui, -apple-system, sans-serif";
    const badgeW = ctx.measureText(badge).width + 36;
    const badgeX = WIDTH - padX - badgeW;
    const badgeY = y - 4;
    ctx.fillStyle = "rgba(110, 231, 183, 0.12)";
    roundRect(ctx, badgeX, badgeY, badgeW, 32, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(110, 231, 183, 0.25)";
    ctx.lineWidth = 1;
    roundRect(ctx, badgeX, badgeY, badgeW, 32, 16);
    ctx.stroke();
    ctx.fillStyle = COLORS.active;
    ctx.fillText(badge, badgeX + 18, badgeY + 7);
  }

  y = 148;
  ctx.fillStyle = COLORS.foreground;
  ctx.font = "300 52px Georgia, 'Times New Roman', serif";
  ctx.fillText(data.memberName, padX, y);

  y += 68;
  ctx.fillStyle = COLORS.accent;
  ctx.font = "400 26px system-ui, -apple-system, sans-serif";
  ctx.fillText(data.tierLabel, padX, y);

  y = HEIGHT - 108;
  if (data.addonDiscountLabel) {
    ctx.fillStyle = COLORS.foreground;
    ctx.font = "500 24px system-ui, -apple-system, sans-serif";
    ctx.fillText(data.addonDiscountLabel, padX, y);
    y += 40;
  }

  ctx.fillStyle = COLORS.muted;
  ctx.font = "400 20px system-ui, -apple-system, sans-serif";
  ctx.fillText(data.memberSinceLabel, padX, y);

  ctx.strokeStyle = "rgba(201, 184, 150, 0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, HEIGHT - 56);
  ctx.lineTo(WIDTH - padX, HEIGHT - 56);
  ctx.stroke();

  for (let i = 0; i < 28; i++) {
    const barX = padX + i * 22;
    const barH = 8 + (i % 3) * 4;
    ctx.fillStyle = i % 2 === 0 ? "rgba(201, 184, 150, 0.35)" : "rgba(245, 242, 235, 0.2)";
    ctx.fillRect(barX, HEIGHT - 44 - barH, 10, barH);
  }
}

export async function renderMemberWalletCardPng(
  data: MemberWalletCardData,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas not supported");
  }

  drawMemberWalletCard(ctx, data);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to render membership card"));
      },
      "image/png",
      1,
    );
  });
}

export function walletCardFileName(memberName: string): string {
  const slug = memberName.trim().replace(/\s+/g, "-").toLowerCase();
  return `homeatlas-${slug || "member"}-card.png`;
}
