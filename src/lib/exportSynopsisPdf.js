// Export du synopsis en PDF (P38, rôle Rédacteur ; P38b : une langue par
// document, FR ou AR). L'arabe est rendu via une mise en page HTML capturée par
// html2canvas (le navigateur façonne l'arabe et gère le RTL — jsPDF en mode
// texte ne sait pas le faire), puis l'image est paginée sur des pages A4. Rien
// n'est stocké : téléchargement direct.
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

const A4_LARGEUR_PT = 595.28
const A4_HAUTEUR_PT = 841.89

const SUFFIXE_FICHIER = { FR: 'FR', AR: 'AR' }

function echapper(texte) {
  const div = document.createElement('div')
  div.textContent = texte ?? ''
  return div.innerHTML
}

function construireNoeud({ programme, chaineNom, synopsisFr, synopsisAr, langue }) {
  const noeud = document.createElement('div')
  noeud.style.cssText =
    'position:fixed;left:-10000px;top:0;width:794px;padding:48px;background:#ffffff;' +
    "font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#0f172a;line-height:1.6;"

  const meta = [programme?.genre, programme?.date_production].filter(Boolean).join(' · ')
  const blocs = [
    `<div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.08em">${echapper(chaineNom)}</div>`,
    `<h1 style="margin:6px 0 2px;font-size:24px">${echapper(programme?.titre ?? 'Programme')}</h1>`,
    meta ? `<div style="font-size:13px;color:#64748b">${echapper(meta)}</div>` : '',
    `<div style="margin:18px 0 24px;border-bottom:2px solid #0f172a"></div>`,
  ]
  if (langue === 'AR') {
    blocs.push(
      `<h2 dir="rtl" style="font-size:16px;margin:0 0 6px;text-align:right;font-family:Tahoma,Arial,sans-serif">ملخص (بالعربية)</h2>`,
      `<div dir="rtl" style="white-space:pre-wrap;font-size:14px;text-align:right;font-family:Tahoma,Arial,sans-serif">${echapper(synopsisAr) || '<span style="color:#94a3b8">(فارغ)</span>'}</div>`
    )
  } else {
    blocs.push(
      `<h2 style="font-size:16px;margin:0 0 6px">Synopsis (français)</h2>`,
      `<div style="white-space:pre-wrap;font-size:14px">${echapper(synopsisFr) || '<span style="color:#94a3b8">(vide)</span>'}</div>`
    )
  }
  noeud.innerHTML = blocs.join('')
  return noeud
}

export async function exporterSynopsisPdf({ programme, chaineNom, synopsisFr, synopsisAr, langue }) {
  const noeud = construireNoeud({ programme, chaineNom, synopsisFr, synopsisAr, langue })
  document.body.appendChild(noeud)
  try {
    const canvas = await html2canvas(noeud, { scale: 2, backgroundColor: '#ffffff' })
    const image = canvas.toDataURL('image/png')
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })

    const largeurImage = A4_LARGEUR_PT
    const hauteurImage = (canvas.height * largeurImage) / canvas.width

    let hauteurRestante = hauteurImage
    let position = 0
    doc.addImage(image, 'PNG', 0, position, largeurImage, hauteurImage)
    hauteurRestante -= A4_HAUTEUR_PT
    while (hauteurRestante > 0) {
      position -= A4_HAUTEUR_PT
      doc.addPage()
      doc.addImage(image, 'PNG', 0, position, largeurImage, hauteurImage)
      hauteurRestante -= A4_HAUTEUR_PT
    }

    const titre = (programme?.titre ?? 'programme').replace(/[\\/:*?"<>|]/g, '-')
    doc.save(`Synopsis ${SUFFIXE_FICHIER[langue] ?? ''} — ${titre}.pdf`)
  } finally {
    noeud.remove()
  }
}
