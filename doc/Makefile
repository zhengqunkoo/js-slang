PDFLATEX = pdflatex

SPECSNUMS = 1 2 3 4 styleguide

SPECS = $(SPECSNUMS:%=source_%)

PDFSPECS = $(SPECS:%=%.pdf)

HELPERS = arrays array_support bnf boolean_operators comments header interpreter intro list_library lists loops names numbers pair_mutators return return_3 stream_library streams strings testlib typing

HELPERSTEX = $(HELPERS:%=source_%.tex)

all: $(PDFSPECS)

# Library dependencies
source_testlib.tex: testlib.source.js

# Generate filtered library files
# The original source in stdlib contains some extra cruft (exports and the like) that we want to cut out
%.source.js: ../dist/stdlib/%.source.js
	sed -n '\_^// ==== start_,\_^// ==== end_p' < $? | head -n-1 | tail -n+2 | grep -v '^exports.' | sed 's/^}$$/}\n/' > $@

%.js: ../dist/stdlib/%.js
	cp $? $@

%.pdf: %.tex $(HELPERSTEX)
	$(PDFLATEX) $? $@

clean:
	rm -f *~ *.dvi *.aux *.log *.ps *.out

cleanall:
	rm -f *~ *.dvi *.aux *.log *.ps *.out *.pdf *.js

install: $(PDFSPECS)
	scp *.pdf cs1101s@sunfire.comp.nus.edu.sg:public_html/source/.
