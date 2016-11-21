from cfg import CFG
import json
import sys
import string
from collections import defaultdict


VERBOSE = True


class Status:

    Consuming = "consuming"
    FoundMatch = "found_match"
    NoMatch = "no_match"
    Idle = "idle"


# for now, this is just a DFA...
class PatternTemplate:
    """
    Class that builds a pattern template architecture and finds match sequences.
    """

    str_idx = -1
    num_chars = 1
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
        return "(%s) %s" % (self.uid, s)

    @staticmethod
    def get_pattern_template_id():
        PatternTemplate.pt_id +=1
        return PatternTemplate.pt_id

    @staticmethod
    def get_uid():
        if PatternTemplate.str_idx >= len(string.ascii_uppercase):
            PatternTemplate.str_idx = 0
            PatternTemplate.num_chars += 1
        uid = string.ascii_uppercase[PatternTemplate.str_idx + 1]
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

    def symbol_matches_current_slot(self, symbol):
        slot_val = self.vars[self.slots[self.current_slot_position]]
        return slot_val == symbol or slot_val == PatternTemplate.WILDCARD

    def at_last_slot(self):
        return (len(self.slots) - 1) == self.current_slot_position

    def consume_next(self, sym):
        if not self.current_var_is_bound():
            self.bind_var(sym, self.slots[self.current_slot_position])
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


class MatchRecord:

    def __init__(self, match_sequence, lhs, rhs_position):
        self.match_sequence = match_sequence
        self.lhs = lhs
        self.rhs_positions = [rhs_position]

    def __str__(self):
        return "lhs: %s rhs_pos: %s\tcount:%d\t%s" % \
               (self.lhs, ','.join([str(rp) for rp in self.rhs_positions]),
                self.get_match_count(), [str(s) for s in self.match_sequence])

    def get_match_count(self):
        return len(self.rhs_positions)

    def add_rhs_position(self, rhs_position):
        self.rhs_positions.append(rhs_position)

    @staticmethod
    def get_hash(seq):
        return '.'.join([str(s) for s in seq])


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
        self.grammar.load_from_text(text)

    def print_match_records(self):
        print("\nMATCH RECORDS --")
        for k in self.match_records.keys():
            print(str(self.match_records[k]))

    def add_match_record(self, seq, lhs, curr_pos):
        # we'll only add the match sequence with relevant information here. leave it to another method for
        # how to replace the found sequences (since there will necessarily be conflicts and ordering considerations)
        match_key = MatchRecord.get_hash(seq)
        rhs_pos = curr_pos - len(seq) + 1
        if match_key in self.match_records.keys():
            self.match_records[match_key].add_rhs_position(rhs_pos)
        else:
            self.match_records[match_key] = MatchRecord(seq, lhs, rhs_pos)

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
                        self.reset_pattern_template_and_make_available(patem, ps)
                    elif status == Status.FoundMatch:
                        match_sequence = patem.get_match_sequence()
                        self.add_match_record(match_sequence, lhs, curr_pos)
                        if VERBOSE:
                            print("found sequence: %s" % ' '.join(match_sequence))
                        self.flag_pattern_template_for_reuse(patem)
                for patem in self.running_pattern_templates[ps]:
                    if patem.is_available():
                        self.reset_pattern_template_and_make_available(patem, ps)

    def replace_matches(self):
        # TODO
        pass

    @staticmethod
    def flag_pattern_template_for_reuse(pattern_template):
        pattern_template.set_is_available(True)

    def reset_pattern_template_and_make_available(self, pattern_template, pattern_string):
        pattern_template.reset()
        self.running_pattern_templates[pattern_string].remove(pattern_template)
        self.available_pattern_templates[pattern_string].append(pattern_template)

    def run_patterns(self):
        # TODO
        for i in range(3):
            print("\n - pattern run %d" % (i+1))
            #self.grammar = PatternFinder.seqs_of_seqs(self.grammar, self.window_length, self.stride)
            #self.grammar = PatternFinder.follows(self.grammar)
            #self.grammar = PatternFinder.precedes(self.grammar)
            #self.grammar.clean_up()

    def print_grammar(self):
        print(str(self.grammar))

    def save_grammar(self, filename="metag.json"):
        fh = open(filename, 'w')
        fh.write(json.dumps(self.grammar.to_serializable(), indent=4, sort_keys=True))
        fh.close()


def simple_text():
    return 'john hit the pedestrian. mary hit a tree!'


def a_few_sentences():
    return 'my undervalued monkey above my leaf ate through another exploding man. another worm under our exciting pajamas interjected through another elephant. my chair sat a girl.'


def cfg_text():
    cfg = CFG()
    cfg.load('simplegrammar.cfg')
    num_sentences = 40
    sents = [' '.join(cfg.generate()) for _ in range(num_sentences)]
    return '.'.join(sents)


def nmw_seq():
    return list('abcdbc')


def runner(text):
    mg = MetaGrammar('x-y')
    mg.initialize(text)
    print("\n--- INITIAL")
    mg.print_grammar()
    print("\n--- PATTERNS...")
    mg.run_patterns()
    print("\n--- FINAL")
    mg.print_grammar()
    #exp_str = mg.grammar.get_expanded_string()
    #print ("EXPANDED STRING: \n %s" % exp_str)
    print("\n--- RANDOM SENTENCES")
    NUM_SENTS = 20
    for i in range(NUM_SENTS):
        exp_rand = mg.grammar.generate()
        print("* %s\n" % exp_rand)
    mg.save_grammar('simplegrammar.json')


if __name__ == '__main__':

    pt = PatternTemplate('xy')

    sys.argv[1] = '1'
    if sys.argv[1] == '1':
        text = simple_text()
    elif sys.argv[1] == '2':
        text = a_few_sentences()
    elif sys.argv[1] == '4':
        text = nmw_seq()
    else:
        text = cfg_text()
    runner(text)
