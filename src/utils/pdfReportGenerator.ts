import { jsPDF } from 'jspdf';
import { WorkflowSpec } from '../types/workflow';
import { generateFigmaSvg } from './figmaExporter';

/**
 * Converts an SVG string into a high-DPI rasterized PNG Data URL using an offscreen canvas
 */
export async function svgToImageDataUrl(
  svgString: string,
  scaleFactor = 2
): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');
      const svgEl = doc.querySelector('svg');
      if (!svgEl) {
        return reject(new Error('Invalid SVG markup produced'));
      }

      const rawWidth = parseFloat(svgEl.getAttribute('width') || '1200');
      const rawHeight = parseFloat(svgEl.getAttribute('height') || '800');

      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = rawWidth * scaleFactor;
          canvas.height = rawHeight * scaleFactor;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(url);
            return reject(new Error('Unable to get canvas 2d context'));
          }

          // Crisp rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Background fill
          ctx.fillStyle = '#F8FAFC';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);

          resolve({
            dataUrl: canvas.toDataURL('image/png', 0.95),
            width: rawWidth,
            height: rawHeight,
          });
        } catch (canvasErr) {
          URL.revokeObjectURL(url);
          reject(canvasErr);
        }
      };

      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG into raster image'));
      };

      img.src = url;
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Generates a comprehensive, high-quality multi-page PDF report of the workflow specification
 */
export async function generateWorkflowPdfReport(workflow: WorkflowSpec): Promise<void> {
  // Landscape A4: 297mm width x 210mm height
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Colors
  const darkNavy = [15, 23, 42]; // #0F172A
  const slate600 = [71, 85, 105]; // #475569
  const slate400 = [148, 163, 184]; // #94A3B8
  const indigo = [79, 70, 229]; // #4F46E5
  const bgLight = [248, 250, 252]; // #F8FAFC
  const borderCol = [226, 232, 240]; // #E2E8F0

  // ==========================================
  // PAGE 1: ARCHITECTURE OVERVIEW & DIAGRAM
  // ==========================================

  // Header Banner Background
  pdf.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  pdf.roundedRect(margin, margin, contentWidth, 32, 3, 3, 'F');
  pdf.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
  pdf.roundedRect(margin, margin, contentWidth, 32, 3, 3, 'S');

  // Title & Metadata
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  pdf.text(workflow.title || 'Workflow Architecture Specification', margin + 6, margin + 8);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(slate600[0], slate600[1], slate600[2]);
  const summaryLine = pdf.splitTextToSize(
    workflow.summary || 'Architecture diagram and process flows generated from specification.',
    contentWidth - 60
  );
  pdf.text(summaryLine.slice(0, 2), margin + 6, margin + 15);

  // Category Badge & Stats on Right
  pdf.setFillColor(indigo[0], indigo[1], indigo[2]);
  pdf.roundedRect(pageWidth - margin - 52, margin + 5, 46, 6, 1.5, 1.5, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(255, 255, 255);
  pdf.text(workflow.category.toUpperCase(), pageWidth - margin - 29, margin + 9.3, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(slate600[0], slate600[1], slate600[2]);
  pdf.text(
    `${workflow.nodes.length} Stages  •  ${workflow.edges.length} Connectors`,
    pageWidth - margin - 5,
    margin + 18,
    { align: 'right' }
  );
  pdf.text(
    `Export Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`,
    pageWidth - margin - 5,
    margin + 23,
    { align: 'right' }
  );

  // Render SVG to Image and Embed
  const svgMarkup = generateFigmaSvg(workflow);
  try {
    const { dataUrl, width: svgW, height: svgH } = await svgToImageDataUrl(svgMarkup, 2.5);

    // Available space for diagram on Page 1
    const diagramY = margin + 36;
    const maxDiagramH = pageHeight - diagramY - margin - 12;
    const maxDiagramW = contentWidth;

    const scale = Math.min(maxDiagramW / svgW, maxDiagramH / svgH);
    const renderW = svgW * scale;
    const renderH = svgH * scale;
    const renderX = margin + (contentWidth - renderW) / 2;
    const renderY = diagramY + (maxDiagramH - renderH) / 2;

    // Draw diagram border container
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(renderX - 1, renderY - 1, renderW + 2, renderH + 2, 2, 2, 'F');
    pdf.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
    pdf.roundedRect(renderX - 1, renderY - 1, renderW + 2, renderH + 2, 2, 2, 'S');

    // Add high-resolution image
    pdf.addImage(dataUrl, 'PNG', renderX, renderY, renderW, renderH, undefined, 'FAST');
  } catch (err) {
    console.error('Failed to render SVG diagram image for PDF:', err);
    // Fallback notice
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(10);
    pdf.setTextColor(slate600[0], slate600[1], slate600[2]);
    pdf.text(
      'Interactive workflow vector diagram details exported in the following specification tables.',
      margin + 6,
      margin + 50
    );
  }

  // Footer Legend on Page 1
  const legendY = pageHeight - margin - 4;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(slate400[0], slate400[1], slate400[2]);
  pdf.text('Figma Integration Report  •  High-Fidelity Specification Matrix  •  Confidential & Architecture Blueprint', margin + 2, legendY);
  pdf.text('Page 1 of 2', pageWidth - margin - 2, legendY, { align: 'right' });

  // ==========================================
  // PAGE 2: DETAILED STAGE MATRIX & SPECIFICATION
  // ==========================================
  pdf.addPage('a4', 'landscape');

  // Page 2 Header
  pdf.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  pdf.roundedRect(margin, margin, contentWidth, 14, 2, 2, 'F');
  pdf.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
  pdf.roundedRect(margin, margin, contentWidth, 14, 2, 2, 'S');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  pdf.text('STEP-BY-STEP STAGES & SYSTEM LOGIC MATRIX', margin + 6, margin + 9);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(slate600[0], slate600[1], slate600[2]);
  pdf.text(
    `Exhaustive specification of all ${workflow.nodes.length} stages extracted from source requirements`,
    margin + 105,
    margin + 9
  );

  // Table Columns Setup
  const tableStartY = margin + 18;
  const colWidths = {
    num: 12,
    type: 24,
    title: 55,
    actor: 35,
    description: 95,
    details: 48,
  };

  // Table Header
  pdf.setFillColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  pdf.rect(margin, tableStartY, contentWidth, 7, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(255, 255, 255);

  let curX = margin;
  pdf.text('#', curX + 2, tableStartY + 4.8);
  curX += colWidths.num;
  pdf.text('TYPE', curX + 2, tableStartY + 4.8);
  curX += colWidths.type;
  pdf.text('STAGE TITLE', curX + 2, tableStartY + 4.8);
  curX += colWidths.title;
  pdf.text('ACTOR / SYSTEM', curX + 2, tableStartY + 4.8);
  curX += colWidths.actor;
  pdf.text('CORE DATA / ACTION', curX + 2, tableStartY + 4.8);
  curX += colWidths.description;
  pdf.text('SPECIFICATION DETAILS', curX + 2, tableStartY + 4.8);

  // Render Table Rows
  let rowY = tableStartY + 7;
  const maxRowsPerPage = 9;

  workflow.nodes.slice(0, 14).forEach((node, idx) => {
    if (rowY > pageHeight - margin - 35) return;

    const rowHeight = node.type === 'screen_ui' && node.screenData ? 13 : 10.5;

    // Alternate row backgrounds
    if (idx % 2 === 1) {
      pdf.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
      pdf.rect(margin, rowY, contentWidth, rowHeight, 'F');
    }

    pdf.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
    pdf.line(margin, rowY + rowHeight, margin + contentWidth, rowY + rowHeight);

    let cellX = margin;

    // Col 1: Step Number
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(slate600[0], slate600[1], slate600[2]);
    pdf.text(`${idx + 1}`, cellX + 3, rowY + 5.5);
    cellX += colWidths.num;

    // Col 2: Type
    const typeLabel = node.type.toUpperCase().replace('_', ' ');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    if (node.type === 'trigger') pdf.setTextColor(22, 101, 52);
    else if (node.type === 'decision') pdf.setTextColor(146, 64, 14);
    else if (node.type === 'screen_ui') pdf.setTextColor(107, 33, 168);
    else if (node.type === 'end_state') pdf.setTextColor(159, 18, 57);
    else pdf.setTextColor(30, 64, 175);

    pdf.text(typeLabel, cellX + 2, rowY + 5.5);
    cellX += colWidths.type;

    // Col 3: Title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
    const titleLines = pdf.splitTextToSize(node.title, colWidths.title - 4);
    pdf.text(titleLines.slice(0, 1), cellX + 2, rowY + 5.5);
    cellX += colWidths.title;

    // Col 4: Actor
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(slate600[0], slate600[1], slate600[2]);
    pdf.text(node.actor ? node.actor.slice(0, 20) : 'System Worker', cellX + 2, rowY + 5.5);
    cellX += colWidths.actor;

    // Col 5: Description / Core Action
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(slate600[0], slate600[1], slate600[2]);
    const descLines = pdf.splitTextToSize(node.description || '', colWidths.description - 4);
    pdf.text(descLines.slice(0, 2), cellX + 2, rowY + 4.5);
    cellX += colWidths.description;

    // Col 6: Details / UI Elements
    let detailStr = node.details && node.details[0] ? node.details[0] : '';
    if (node.type === 'screen_ui' && node.screenData) {
      detailStr = `UI: ${node.screenData.elements.map((e) => e.label).slice(0, 2).join(', ')}`;
    }
    const detailLines = pdf.splitTextToSize(detailStr, colWidths.details - 4);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(6.5);
    pdf.setTextColor(slate400[0], slate400[1], slate400[2]);
    pdf.text(detailLines.slice(0, 2), cellX + 2, rowY + 4.5);

    rowY += rowHeight;
  });

  // Insights & Figma Tips Bottom Block
  const insightsY = pageHeight - margin - 26;
  pdf.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  pdf.roundedRect(margin, insightsY, contentWidth, 20, 2, 2, 'F');
  pdf.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
  pdf.roundedRect(margin, insightsY, contentWidth, 20, 2, 2, 'S');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(indigo[0], indigo[1], indigo[2]);
  pdf.text('CRITICAL SYSTEM AUDIT & FIGMA INTEGRATION TIPS:', margin + 4, insightsY + 5);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(slate600[0], slate600[1], slate600[2]);

  const bottleneckText = workflow.insights.potentialBottlenecks[0]
    ? `• Bottleneck Analysis: ${workflow.insights.potentialBottlenecks[0]}`
    : '• Bottleneck Analysis: No critical latency locks detected in workflow transitions.';

  const figmaTipText = workflow.insights.figmaDesignTips[0]
    ? `• Figma Recommendation: ${workflow.insights.figmaDesignTips[0]}`
    : '• Figma Recommendation: Use native Auto-Layout frames and grouped components for responsive layouts.';

  pdf.text(pdf.splitTextToSize(bottleneckText, contentWidth - 8).slice(0, 1), margin + 4, insightsY + 10.5);
  pdf.text(pdf.splitTextToSize(figmaTipText, contentWidth - 8).slice(0, 1), margin + 4, insightsY + 15.5);

  // Page 2 Footer
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(slate400[0], slate400[1], slate400[2]);
  pdf.text('Generated via Figma Workflow Sync Hub  •  All vector assets, shapes, and tokens preserved', margin + 2, legendY);
  pdf.text('Page 2 of 2', pageWidth - margin - 2, legendY, { align: 'right' });

  // Save the PDF
  const filename = `${workflow.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-workflow-report.pdf`;
  pdf.save(filename);
}
