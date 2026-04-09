// ESC/POS commands for thermal printers
const ESC = '\x1B';
const GS = '\x1D';
const CMD = {
  INIT: ESC + '\x40',           // Initialize printer
  CENTER: ESC + '\x61\x01',     // Center alignment
  LEFT: ESC + '\x61\x00',       // Left alignment
  RIGHT: ESC + '\x61\x02',      // Right alignment
  BOLD_ON: ESC + '\x45\x01',    // Bold on
  BOLD_OFF: ESC + '\x45\x00',   // Bold off
  DOUBLE: ESC + '\x21\x30',     // Double height + width
  NORMAL: ESC + '\x21\x00',     // Normal size
  SMALL: ESC + '\x4D\x01',      // Small font
  SMALL_OFF: ESC + '\x4D\x00',  // Normal font
  CUT: GS + '\x56\x00',         // Full cut
  PARTIAL_CUT: GS + '\x56\x01', // Partial cut
  FEED: '\n',
};

// 80mm thermal = ~48 chars per line (normal font)
const LINE_WIDTH = 48;

export function pad(text: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string {
  if (text.length >= width) return text.substring(0, width);
  const spaces = width - text.length;
  if (align === 'right') return ' '.repeat(spaces) + text;
  if (align === 'center') {
    const left = Math.floor(spaces / 2);
    return ' '.repeat(left) + text + ' '.repeat(spaces - left);
  }
  return text + ' '.repeat(spaces);
}

function line(left: string, right: string, width: number = LINE_WIDTH): string {
  const gap = width - left.length - right.length;
  if (gap < 1) return left.substring(0, width - right.length - 1) + ' ' + right;
  return left + ' '.repeat(gap) + right;
}

function separator(char: string = '-', width: number = LINE_WIDTH): string {
  return char.repeat(width) + '\n';
}

function formatMoney(amount: number): string {
  return '$' + amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  promotionName?: string;
}

export interface ReceiptData {
  saleNumber: string;
  date?: Date;
  customerName?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod?: string;
  paymentAmount?: number;
  change?: number;
  isFiscal?: boolean;
  storeName?: string;
}

export function generateReceiptCommands(data: ReceiptData): string[] {
  const cmds: string[] = [];
  const now = data.date || new Date();
  const fecha = now.toLocaleDateString('es-AR') + ' ' + now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  // Initialize
  cmds.push(CMD.INIT);

  // Header
  cmds.push(CMD.CENTER);
  if (data.storeName) {
    cmds.push(CMD.BOLD_ON);
    cmds.push(CMD.DOUBLE);
    cmds.push(data.storeName + '\n');
    cmds.push(CMD.NORMAL);
    cmds.push(CMD.BOLD_OFF);
  }
  cmds.push(CMD.BOLD_ON);
  cmds.push(data.isFiscal ? 'FACTURA\n' : 'NOTA DE PEDIDO\n');
  cmds.push(CMD.BOLD_OFF);
  cmds.push(CMD.SMALL);
  cmds.push('Documento no fiscal\n');
  cmds.push(CMD.SMALL_OFF);
  cmds.push(CMD.LEFT);

  // Separator
  cmds.push(separator('='));

  // Sale info
  cmds.push(CMD.BOLD_ON);
  cmds.push(data.saleNumber + '\n');
  cmds.push(CMD.BOLD_OFF);
  cmds.push(fecha + '\n');
  if (data.customerName) {
    cmds.push('Cliente: ' + data.customerName + '\n');
  }

  cmds.push(separator());

  // Items
  for (const item of data.items) {
    const name = item.name.length > LINE_WIDTH ? item.name.substring(0, LINE_WIDTH) : item.name;
    cmds.push(CMD.BOLD_ON);
    cmds.push(name + '\n');
    cmds.push(CMD.BOLD_OFF);

    const qtyPrice = `  ${item.quantity} x ${formatMoney(item.unitPrice)}`;
    const subtotalStr = formatMoney(item.subtotal);
    cmds.push(line(qtyPrice, subtotalStr) + '\n');

    if (item.discount > 0) {
      cmds.push(line('  Desc:', '-' + formatMoney(item.discount)) + '\n');
    }
    if (item.promotionName) {
      cmds.push(CMD.SMALL);
      cmds.push('  ' + item.promotionName + '\n');
      cmds.push(CMD.SMALL_OFF);
    }
  }

  cmds.push(separator());

  // Totals
  if (data.discount > 0) {
    cmds.push(line('Subtotal:', formatMoney(data.subtotal)) + '\n');
    cmds.push(line('Descuento:', '-' + formatMoney(data.discount)) + '\n');
    cmds.push(separator());
  }

  cmds.push(CMD.BOLD_ON);
  cmds.push(CMD.DOUBLE);
  cmds.push(line('TOTAL', formatMoney(data.total), LINE_WIDTH / 2) + '\n');
  cmds.push(CMD.NORMAL);
  cmds.push(CMD.BOLD_OFF);

  // Payment
  if (data.paymentMethod) {
    cmds.push(CMD.FEED);
    cmds.push(line('Pago:', data.paymentMethod) + '\n');
    if (data.paymentAmount) {
      cmds.push(line('Entregado:', formatMoney(data.paymentAmount)) + '\n');
    }
    if (data.change && data.change > 0) {
      cmds.push(CMD.BOLD_ON);
      cmds.push(line('Cambio:', formatMoney(data.change)) + '\n');
      cmds.push(CMD.BOLD_OFF);
    }
  }

  // Footer
  cmds.push(CMD.FEED);
  cmds.push(separator());
  cmds.push(CMD.CENTER);
  cmds.push('Gracias por su compra\n');
  cmds.push(CMD.FEED);
  cmds.push(CMD.FEED);
  cmds.push(CMD.FEED);
  cmds.push(CMD.PARTIAL_CUT);

  return cmds;
}
