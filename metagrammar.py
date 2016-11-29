from cfg import CFG, Symbol
import json
import sys
import string
from collections import defaultdict
import re
import nltk

VERBOSE = True


class Status:

    Consuming = "consuming"
    FoundMatch = "found_match"
    NoMatch = "no_match"
    Idle = "idle"


class PatternTemplate:
    """
    Class that builds a pattern template architecture and finds match sequences.
    """

    str_idx = -1
    id_num = 0
    pt_id = 0
    WILDCARD = '*'

    def __init__(self, pattern_def_string: str, is_available=False) -> object:
        self.pattern_def_string = pattern_def_string
        self.status = Status.Idle
        self.vars = dict()
        self.slots = list(pattern_def_string)
        self.current_slot_position = 0
        self.uid = PatternTemplate.get_pattern_template_id()
        self._is_available = is_available

    def __str__(self):
        s = self.pattern_def_string
        return "(%s) %s [%s]" % (self.uid, s, ",".join(["%s:%s" % (k, self.vars[k]) for k in self.vars.keys()]))

    @staticmethod
    def get_pattern_template_id():
        PatternTemplate.pt_id +=1
        return PatternTemplate.pt_id

    @staticmethod
    def get_uid():
        if (PatternTemplate.str_idx + 1) >= len(string.ascii_uppercase):
            PatternTemplate.id_num += 1
            PatternTemplate.str_idx = 0
        uid = "%s_%d" % (string.ascii_uppercase[PatternTemplate.str_idx + 1], PatternTemplate.id_num)
        PatternTemplate.str_idx += 1
        return uid

    def set_is_available(self, is_available):
        self._is_available = is_available

    def is_available(self):
        return self._is_available

    def parse(self, pattern_string):
        self.slots = list(pattern_string)

    def get_status(self):
        return self.status

    def bind_var(self, symbol, var):
        self.vars[var] = symbol

    def current_var_is_bound(self):
        var = self.slots[self.current_slot_position]
        return var in self.vars.keys()

    def symbol_matches_current_slot(self, symbol: Symbol):
        slot_val = self.vars[self.slots[self.current_slot_position]]
        return slot_val == symbol or slot_val == Symbol(PatternTemplate.WILDCARD, True)

    def at_last_slot(self):
        return (len(self.slots) - 1) == self.current_slot_position

    def symbol_already_exists(self, symbol):
        return symbol in [self.vars[k] for k in self.vars.keys()]

    def consume_next(self, sym):
        # note that this needs to be checked before binding
        already_exists = self.symbol_already_exists(sym)
        if not self.current_var_is_bound() and not already_exists:
            self.bind_var(sym, self.slots[self.current_slot_position])
        elif already_exists and not self.current_var_is_bound():
            # if the symbol already exists but does not match the current slot, then it isn't a match
            self.advance_slot_position()  # probably not necessary, but just in case
            return Status.NoMatch
        at_last_slot = self.at_last_slot()
        symbol_does_match = self.symbol_matches_current_slot(sym)
        if at_last_slot:
            if symbol_does_match:
                self.status = Status.FoundMatch
            else:
                self.status = Status.NoMatch
        else:
            if symbol_does_match:
                self.status = Status.Consuming
            else:
                self.status = Status.NoMatch
        self.advance_slot_position()
        return self.status

    def consume_sequence(self, seq):
        found_match = False
        for s in seq:
            self.consume_next(s)
            if self.status == Status.NoMatch:
                break
        if self.status == Status.FoundMatch:
            found_match = True
        self.reset()
        return found_match

    def advance_slot_position(self):
        self.current_slot_position += 1

    def reset(self):
        self.vars = dict()
        self.status = Status.Idle
        self.current_slot_position = 0

    def get_match_sequence(self) -> list:
        return list(map(lambda s: self.vars[s], self.slots))


class GrammarPosition:

    def __init__(self, lhs, rhs_beg, rhs_end):
        self.lhs = lhs
        self.rhs_begin = rhs_beg
        self.rhs_end = rhs_end

    def __str__(self):
        return "@%s(%d, %d)" % (self.lhs, self.rhs_begin, self.rhs_end)

    def __eq__(self, other):
        same_position = self.rhs_begin == other.rhs_begin and self.rhs_end == other.rhs_end
        overlapped_positions = (self.rhs_begin <= other.rhs_begin <= self.rhs_end) or \
                               (self.rhs_begin <= other.rhs_end <= self.rhs_end)
        return self.lhs == other.lhs and (same_position or overlapped_positions)


class MatchRecord:

    mr_count = 0

    def __init__(self, match_sequence, lhs, rhs_begin, rhs_end):
        self.match_sequence = match_sequence
        self.grammar_positions = [GrammarPosition(lhs, rhs_begin, rhs_end)]
        self._count = MatchRecord.mr_count
        MatchRecord.mr_count += 1

    def __str__(self):
        return "count:%d\t%s\t\tpos %s" % \
                (self.get_num_matches(), [str(s) for s in self.match_sequence],
                 '; '.join([str(gp) for gp in self.grammar_positions]))

    @staticmethod
    def dedupe_grammar_positions(grammar_positions):
        """
        ensure that the grammar positions do not overlap and are the not the same in any other regard
        """
        ddp_poss = []
        for gp in grammar_positions:
            if not gp in ddp_poss:
                ddp_poss.append(gp)
        return ddp_poss

    def get_num_matches(self):
        ddp_pos = MatchRecord.dedupe_grammar_positions(self.grammar_positions)
        return len(ddp_pos)

    def add_new_position(self, lhs, rhs_begin, rhs_end):
        self.grammar_positions.append(GrammarPosition(lhs, rhs_begin, rhs_end))

    @staticmethod
    def get_hash(seq, wildcard_idxs):
        if wildcard_idxs is None:
            wildcard_idxs = []
        return '.'.join(['*' if i in wildcard_idxs else str(seq[i]) for i in range(len(seq))])


class MetaGrammar:

    def __init__(self, pattern_strings):
        self.grammar = CFG()
        self.running_pattern_templates = defaultdict(list)
        self.available_pattern_templates = defaultdict(list)
        self.match_records = dict()
        self.pattern_strings = pattern_strings
        for ps in pattern_strings:
            # initialize a first pattern template for each of the types of pattern templates
            # more will be created as needed to track patterns as the sequence is traversed
            self.available_pattern_templates[ps].append(PatternTemplate(ps))

    def initialize(self, text):
        text_clean = MetaGrammar.clean(text)
        self.grammar.load_from_text(text_clean)

    @staticmethod
    def clean(text):
        text_clean = re.sub(r"[^\w\s.!?]", "", text)
        return text_clean

    def print_match_records(self):
        print("\nMATCH RECORDS --")
        for k in self.match_records.keys():
            if self.match_records[k].get_num_matches() > 1:
                print(str(self.match_records[k]))

    @staticmethod
    def get_wildcard_idxs(pattern_string):
        idxs = []
        lst = list(pattern_string)
        for i in range(len(lst)):
            if lst[i] == PatternTemplate.WILDCARD:
                idxs.append(i)
        return idxs

    def add_match_record(self, seq, lhs, curr_pos, wildcard_idxs):
        # we'll only add the match sequence with relevant information here. leave it to another method for
        # how to replace the found sequences (since there will necessarily be conflicts and ordering considerations)
        match_key = MatchRecord.get_hash(seq, wildcard_idxs)
        rhs_begin = curr_pos - len(seq) + 1
        if match_key in self.match_records.keys():
            self.match_records[match_key].add_new_position(lhs, rhs_begin, curr_pos)
        else:
            seq_sub = [Symbol(PatternTemplate.WILDCARD, True) if i in wildcard_idxs else seq[i] for i in range(len(seq))]
            self.match_records[match_key] = MatchRecord(seq_sub, lhs, rhs_begin, curr_pos)

    def ensure_running_pattern_templates_exist(self, pattern_string):
        # either use an existing and available pattern template or create a new one if necessary
        if len(self.available_pattern_templates[pattern_string]) == 0:
            # there aren't any already available so create a new one
            self.running_pattern_templates[pattern_string].append(PatternTemplate(pattern_string, is_available=False))
        else:
            # reuse a pattern template for the new subsequence starting at curr_pos
            patem = self.available_pattern_templates[pattern_string].pop()
            patem.set_is_available(False)
            self.running_pattern_templates[pattern_string].append(patem)

    def consume_sequence(self, seq, lhs):
        for curr_pos in range(len(seq)):
            symbol = seq[curr_pos]
            for ps in self.pattern_strings:
                self.ensure_running_pattern_templates_exist(ps)
                for patem in self.running_pattern_templates[ps]:
                    status = patem.consume_next(symbol)
                    if status == Status.NoMatch:
                        self.flag_pattern_template_for_reuse(patem)
                        #self.reset_pattern_template_and_make_available(patem, ps)
                    elif status == Status.FoundMatch:
                        match_sequence = patem.get_match_sequence()
                        wildcard_idxs = self.get_wildcard_idxs(ps)
                        self.add_match_record(match_sequence, lhs, curr_pos, wildcard_idxs)
                        if VERBOSE:
                            print("  --- found sequence: '%s' for pattern '%s'" % (' '.join([str(ms) for ms in match_sequence]), ps))
                        self.flag_pattern_template_for_reuse(patem)
                for patem in self.running_pattern_templates[ps]:
                    if patem.is_available():
                        self.reset_pattern_template_and_make_available(patem, ps)

    @staticmethod
    def get_wildcard_match_vals(match_sequence, replacement_sequence):
        wildcard_matches = [replacement_sequence[i] for i in range(len(replacement_sequence))
                            if match_sequence[i] == Symbol(PatternTemplate.WILDCARD, True)]
        return wildcard_matches

    @staticmethod
    def replace_all_instances(sequence, subsequence, replacement_symbol: Symbol) -> list:
        new_sequence = []
        seq_i = 0
        wildcard_matches = []
        while seq_i < len(sequence):
            if (seq_i + len(subsequence)) > len(sequence):
                new_sequence.extend(sequence[seq_i:])
                break
            matches = [False for _ in range(len(subsequence))]
            for sub_i in range(0, len(subsequence)):
                matches[sub_i] = subsequence[sub_i] == sequence[seq_i+sub_i] or \
                                 subsequence[sub_i] == Symbol(PatternTemplate.WILDCARD, True)
            if all(matches):
                if Symbol(PatternTemplate.WILDCARD, True) in subsequence:
                    match_sequence = sequence[seq_i:seq_i+len(subsequence)]
                    wildcard_matches.extend(MetaGrammar.get_wildcard_match_vals(subsequence, match_sequence))
                new_sequence.append(replacement_symbol)
                seq_i += len(subsequence)
            else:
                new_sequence.append(sequence[seq_i])
                seq_i += 1
        return new_sequence, wildcard_matches

    def replace_matches(self):
        # for now, replace by "first encountered"
        mr_keys = list(self.match_records.keys())
        mr_keys_srt = sorted(mr_keys, key=lambda x: self.match_records[x].get_num_matches(), reverse=True)
        mr_keys_fil = list(filter(lambda x: self.match_records[x].get_num_matches() > 1, mr_keys_srt))
        new_rules = defaultdict(list)
        for k in mr_keys_fil:
            # ensure that we have at least 2 matches to make this a new rule
            if self.match_records[k].get_num_matches() <= 1:
                continue
            new_val = PatternTemplate.get_uid()
            newval_sym = Symbol(new_val, is_terminal=False)
            match_record = self.match_records[k]
            for lhs in self.grammar.rules.keys():
                for rhs in self.grammar.rules[lhs]:
                    new_rhs, wildcard_matches = MetaGrammar.replace_all_instances(rhs, match_record.match_sequence, newval_sym)
                    found_match = len(new_rhs) != len(rhs) or any([new_rhs[i] != rhs[i] for i in range(len(rhs))])
                    self.grammar.rules[lhs] = [new_rhs if r == rhs else r for r in self.grammar.rules[lhs]]
                    if len(wildcard_matches) > 0:
                        new_wildcard_rule_lhs = PatternTemplate.get_uid()
                        new_rules[new_wildcard_rule_lhs] = [[w] for w in wildcard_matches]
                        new_rules[new_val] = [[sym if sym != Symbol(PatternTemplate.WILDCARD, True) else Symbol(new_wildcard_rule_lhs, False)
                                               for sym in match_record.match_sequence[:]]]
                    elif found_match:
                        new_rules[new_val] = [[sym for sym in match_record.match_sequence[:]]]
        for new_rule_lhs in new_rules.keys():
            self.grammar.rules[new_rule_lhs] = new_rules[new_rule_lhs]
        foo = 1

    def reset_matches(self):
        self.match_records = dict()

    def get_matches(self):
        for rule_lhs in self.grammar.rules.keys():
            if VERBOSE:
                print("LHS: %s" % rule_lhs)
            for rhs in self.grammar.rules[rule_lhs]:
                if VERBOSE:
                    print("RHS: %s" % [sym.val for sym in rhs])
                self.consume_sequence(rhs, rule_lhs)
                self.reset_all_pattern_templates()

    def matches_found(self):
        filtered_list = list(filter(lambda x: self.match_records[x].get_num_matches() > 1, list(self.match_records.keys())))
        return len(filtered_list) > 0

    @staticmethod
    def flag_pattern_template_for_reuse(pattern_template):
        pattern_template.set_is_available(True)

    def reset_pattern_template_and_make_available(self, pattern_template, pattern_string):
        pattern_template.reset()
        self.running_pattern_templates[pattern_string].remove(pattern_template)
        self.available_pattern_templates[pattern_string].append(pattern_template)

    def reset_all_pattern_templates(self):
        for ps_key in self.running_pattern_templates.keys():
            for patem in self.running_pattern_templates[ps_key]:
                self.reset_pattern_template_and_make_available(patem, ps_key)

    def run(self):
        fh = open("metagrammar_run.txt", 'w')
        self.print_to_file(fh)
        self.get_matches()
        while self.matches_found():
            self.print_match_records()
            self.replace_matches()
            self.print_to_file(fh)
            self.print_grammar()
            self.reset_matches()
            self.get_matches()
        fh.close()

    def print_grammar(self):
        print("\nGRAMMAR --\n%s" % str(self.grammar))

    def print_to_file(self, fh):
        fh.write("\nGRAMMAR --\n%s" % str(self.grammar))

    def save_grammar(self, filename="metag.json"):
        fh = open(filename, 'w')
        fh.write(json.dumps(self.grammar.to_serializable(), indent=4, sort_keys=True))
        fh.close()


def simple_text():
    return 'john hit the pedestrian. mary hit a tree!'


def a_few_sentences():
    return """
    my undervalued monkey above my leaf ate through another exploding man.
    another worm under our exciting pajamas interjected through another elephant.
    my chair sat a girl.
    """


def cfg_text():
    cfg = CFG()
    cfg.load('resources/simplegrammar.cfg')
    num_sentences = 40
    sents = []
    for i in range(num_sentences):
        sents.append(cfg.generate())
    #sents_jn = ' '.join(sents)
    return sents


def nmw_seq():
    return 'a b c d b c b c b c b c'
    #return 'a b a b'


def remove_non_wordspacechars(text):
    return re.sub(r"[^\w\s]", "", text)

def sense_and_sensibility(how_many=400):
    sents = [' '.join(s) for s in nltk.corpus.gutenberg.sents('austen-sense.txt')][2:how_many]
    return '.'.join([remove_non_wordspacechars(s) for s in sents])


def runner(text):
    mg = MetaGrammar(['x*'])
    mg.initialize(text)
    print("\n--- INITIAL")
    mg.print_grammar()
    print("\n--- PATTERNS...")
    mg.run()
    print("\n--- FINAL")
    mg.print_grammar()
    print("\n--- RANDOM SENTENCES")
    NUM_SENTS = 20
    fh_randsents = open('metagrammar_random_sentences.txt', 'w')
    for i in range(NUM_SENTS):
        exp_rand = mg.grammar.generate()
        s = "* %s\n" % exp_rand
        print(s)
        fh_randsents.write(s)
    fh_randsents.close()
    mg.save_grammar('simplegrammar.json')


if __name__ == '__main__':
    sys.argv[1] = 'sense'
    if sys.argv[1] == 'simple':
        text = simple_text()
    elif sys.argv[1] == 'few':
        text = a_few_sentences()
    elif sys.argv[1] == 'nmw':
        text = nmw_seq()
    elif sys.argv[1] == 'cfg':
        text = cfg_text()
    elif sys.argv[1] == 'sense':
        text = sense_and_sensibility(how_many=500)
    else:
        text = cfg_text()
    runner(text)
    print("done")
