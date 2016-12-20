from nltk.corpus import gutenberg
import re

sents = gutenberg.sents('austen-sense.txt')

fh = open('sense_sents.txt', 'w')
skip = 1

def clean(line):
    cln = re.sub(r"[^\w\s]","", line)
    cln = cln.lower()
    return cln

for line in sents[(skip+1):]:
    fh.write(clean(' '.join(line) + "\n"))

fh.close()
