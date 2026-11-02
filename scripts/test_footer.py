import docx
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

doc = docx.Document()
section = doc.sections[0]
footer = section.footer
p = footer.paragraphs[0]
p.alignment = docx.enum.text.WD_ALIGN_PARAGRAPH.RIGHT

r1 = p.add_run("Assetra Final Project Report | Page ")
r1.font.name = "Times New Roman"
r1.font.size = docx.shared.Pt(10)

run_page = p.add_run()
run_page.font.name = "Times New Roman"
run_page.font.size = docx.shared.Pt(10)
fld_page = parse_xml(r'<w:fldSimple %s w:instr="PAGE"/>' % nsdecls('w'))
run_page._r.append(fld_page)

r2 = p.add_run(" of ")
r2.font.name = "Times New Roman"
r2.font.size = docx.shared.Pt(10)

run_total = p.add_run()
run_total.font.name = "Times New Roman"
run_total.font.size = docx.shared.Pt(10)
fld_total = parse_xml(r'<w:fldSimple %s w:instr="NUMPAGES"/>' % nsdecls('w'))
run_total._r.append(fld_total)

doc.save("C:/Assetra/scratch/test_footer.docx")
print("Footer page number script passed")

