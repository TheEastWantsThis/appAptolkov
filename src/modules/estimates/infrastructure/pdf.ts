import path from "node:path";

import PDFDocument from "pdfkit";

export type PdfMode = "client" | "internal";

export interface PdfEstimateLine {
  description: string;
  quantity: number;
  unit: string;
  clientUnitPrice: number;
  clientAmount: number;
  internalUnitPrice: number;
  internalAmount: number;
}

export interface PdfEstimateData {
  number: string;
  version: number;
  customerName: string;
  address: string;
  authorName: string;
  createdAt: Date;
  discountPercent: number;
  subtotalClient: number;
  discountAmount: number;
  totalClient: number;
  totalInternal: number;
  lines: readonly PdfEstimateLine[];
}

const unitLabels: Record<string, string> = {
  M2: "м²",
  M: "м",
  PCS: "шт.",
  FIXED: "усл.",
  ZONE: "зона",
  COEFFICIENT: "коэф.",
};
const rub = (value: number) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + " ₽";

export async function generateEstimatePdf(
  data: PdfEstimateData,
  mode: PdfMode,
): Promise<Buffer> {
  const regular = path.join(
    process.cwd(),
    "public",
    "fonts",
    "Inter-Regular.ttf",
  );
  const bold = path.join(process.cwd(), "public", "fonts", "Inter-Bold.ttf");
  const doc = new PDFDocument({
    size: "A4",
    margin: 42,
    bufferPages: true,
    info: {
      Title: `Смета ${data.number} версия ${data.version}`,
      Author: "Апотолков CRM",
    },
  });
  doc.registerFont("Inter", regular);
  doc.registerFont("InterBold", bold);
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const pageWidth = 511;
  const columns =
    mode === "internal"
      ? [
          { key: "description", label: "Позиция", width: 218 },
          { key: "quantity", label: "Кол-во", width: 55 },
          { key: "clientAmount", label: "Клиент", width: 92 },
          { key: "internalAmount", label: "Себестоимость", width: 110 },
        ]
      : [
          { key: "description", label: "Позиция", width: 280 },
          { key: "quantity", label: "Кол-во", width: 70 },
          { key: "clientUnitPrice", label: "Цена", width: 75 },
          { key: "clientAmount", label: "Сумма", width: 86 },
        ];

  const header = () => {
    doc
      .font("InterBold")
      .fontSize(10)
      .fillColor("#1e3a8a")
      .text("АПОТОЛКОВ", 42, 34);
    doc
      .font("Inter")
      .fontSize(8)
      .fillColor("#64748b")
      .text(
        mode === "internal" ? "Внутренняя смета" : "Клиентская смета",
        42,
        49,
      );
    doc.moveTo(42, 65).lineTo(553, 65).strokeColor("#cbd5e1").stroke();
  };
  const tableHeader = (y: number) => {
    doc.rect(42, y, pageWidth, 24).fill("#e2e8f0");
    let x = 42;
    for (const column of columns) {
      doc
        .font("InterBold")
        .fontSize(8)
        .fillColor("#334155")
        .text(column.label, x + 5, y + 8, {
          width: column.width - 10,
          lineBreak: false,
        });
      x += column.width;
    }
    return y + 24;
  };
  const ensureSpace = (needed: number, currentY: number) => {
    if (currentY + needed <= 770) return currentY;
    doc.addPage();
    header();
    return tableHeader(82);
  };

  header();
  doc
    .font("InterBold")
    .fontSize(20)
    .fillColor("#0f172a")
    .text(`Смета № ${data.number}`, 42, 86);
  doc.font("Inter").fontSize(9).fillColor("#475569");
  doc.text(`Версия: ${data.version}`, 42, 118);
  doc.text(`Дата: ${data.createdAt.toLocaleDateString("ru-RU")}`, 200, 118);
  doc.text(`Автор: ${data.authorName}`, 360, 118);
  doc.roundedRect(42, 140, pageWidth, 62, 6).fill("#f8fafc");
  doc
    .font("InterBold")
    .fontSize(10)
    .fillColor("#0f172a")
    .text(data.customerName, 54, 153);
  doc
    .font("Inter")
    .fontSize(9)
    .fillColor("#475569")
    .text(data.address, 54, 172, { width: 480 });
  let y = tableHeader(222);

  for (const line of data.lines) {
    const quantity = `${line.quantity} ${unitLabels[line.unit] ?? line.unit}`;
    const rowValues =
      mode === "internal"
        ? [
            line.description,
            quantity,
            rub(line.clientAmount),
            rub(line.internalAmount),
          ]
        : [
            line.description,
            quantity,
            rub(line.clientUnitPrice),
            rub(line.clientAmount),
          ];
    const descriptionColumn = columns[0];
    if (!descriptionColumn)
      throw new Error("Не настроена колонка описания PDF");
    const descriptionHeight = doc
      .font("Inter")
      .fontSize(8)
      .heightOfString(line.description, {
        width: descriptionColumn.width - 10,
      });
    const rowHeight = Math.max(26, descriptionHeight + 12);
    y = ensureSpace(rowHeight, y);
    let x = 42;
    if (Math.floor((y - 246) / 26) % 2 === 1)
      doc.rect(42, y, pageWidth, rowHeight).fill("#f8fafc");
    rowValues.forEach((value, index) => {
      const column = columns[index];
      if (!column) return;
      doc
        .font(index === 0 ? "Inter" : "Inter")
        .fontSize(8)
        .fillColor("#1e293b")
        .text(value, x + 5, y + 7, {
          width: column.width - 10,
          align: index > 1 ? "right" : "left",
        });
      x += column.width;
    });
    doc
      .moveTo(42, y + rowHeight)
      .lineTo(553, y + rowHeight)
      .strokeColor("#e2e8f0")
      .stroke();
    y += rowHeight;
  }

  y = ensureSpace(mode === "internal" ? 132 : 112, y + 14);
  const totalsX = 328;
  const total = (label: string, value: string, strong = false) => {
    doc
      .font(strong ? "InterBold" : "Inter")
      .fontSize(strong ? 11 : 9)
      .fillColor(strong ? "#0f172a" : "#475569")
      .text(label, totalsX, y, { width: 120 });
    doc.text(value, 448, y, { width: 105, align: "right" });
    y += strong ? 24 : 19;
  };
  total("Подытог", rub(data.subtotalClient));
  if (data.discountPercent > 0)
    total(`Скидка ${data.discountPercent}%`, "-" + rub(data.discountAmount));
  total("Итого клиенту", rub(data.totalClient), true);
  if (mode === "internal") {
    doc.moveTo(totalsX, y).lineTo(553, y).strokeColor("#cbd5e1").stroke();
    y += 10;
    total("Себестоимость", rub(data.totalInternal), true);
  }
  doc
    .font("Inter")
    .fontSize(7)
    .fillColor("#94a3b8")
    .text(
      "Смета сформирована автоматически. Срок действия и условия уточняются у менеджера.",
      42,
      Math.max(y + 20, 735),
      { width: pageWidth, align: "center" },
    );

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .font("Inter")
      .fontSize(7)
      .fillColor("#94a3b8")
      .text(`Страница ${i + 1} из ${range.count}`, 42, 786, {
        width: pageWidth,
        align: "center",
        lineBreak: false,
      });
  }
  doc.end();
  return done;
}
