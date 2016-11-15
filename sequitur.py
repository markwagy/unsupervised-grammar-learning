import string


class Node:

    id = 0

    def __init__(self, data, prevnode=None, nextnode=None, is_terminal=False):
        self._data = data
        self._next = nextnode
        self._prev = prevnode
        self._is_terminal = is_terminal
        self._rule_ptr = None
        self._nodeid = Node.get_unique_nodeid()

    def __str__(self):
        return "[%s_%d]" % (str(self._data), self._nodeid)

    #def __eq__(self, other):
    #    return other.get_uuid() == self._uuid

    @staticmethod
    def get_unique_nodeid():
        Node.id += 1
        return Node.id

    def get_nodeid(self):
        return self._nodeid

    @staticmethod
    def get_symlink(node):
        new_node = Node(node.get_data(), is_terminal=False)
        new_node._rule_ptr = node
        return new_node

    def get_next(self):
        return self._next

    def get_rule_ptr(self):
        return self._rule_ptr

    def set_rule_ptr(self, rule_node):
        self._rule_ptr = rule_node

    def get_prev(self):
        return self._prev

    def get_data(self):
        return self._data

    def set_next(self, nodeval):
        self._next = nodeval

    def set_prev(self, nodeval):
        self._prev = nodeval

    def is_terminal(self):
        return self._is_terminal


class Digram:

    def __init__(self, left, right):
        self.le = left
        self.ri = right

    def __str__(self):
        return "(%s %s)" % (self.le, self.ri)

    def contains_guard_node(self):
        return Sequitur.is_guard_node(self.le) or Sequitur.is_guard_node(self.ri)


class Sequitur:

    GUARD_SYMBOL = '[]'
    START_SYMBOL = 'S'

    str_idx = -1
    num_chars = 1

    @staticmethod
    def get_uid():
        if Sequitur.str_idx >= len(string.ascii_uppercase):
            Sequitur.str_idx = 0
            Sequitur.num_chars += 1
        uid = string.ascii_uppercase[Sequitur.str_idx + 1]
        Sequitur.str_idx += 1
        return uid

    def __init__(self):
        self.digram_index = dict()
        # start off rule structure with the start rule
        self.start_rule = Sequitur.construct_start_rule()

    @staticmethod
    def construct_start_rule():
        rule_node = Node(Sequitur.START_SYMBOL, is_terminal=False)
        guard_node = Sequitur.create_guard_node(rule_node)
        rule_node.set_next(guard_node)
        guard_node.set_prev(rule_node)
        return rule_node

    def __str__(self):
        return " ".join(["%s" % str(s) for s in self.digram_index])

    def print_grammar_string(self):
        rules = Sequitur.get_rules(self.start_rule)
        s = '\n'.join([Sequitur.rule_string(r) for r in rules])
        print("----GRAMMAR----\n%s\n---------------\n" % s)

    def p(self):
        self.print_grammar_string()

    @staticmethod
    def rule_string(rule_head_node: Node) -> str:
        s = rule_head_node.get_data()
        s += " -> "
        # skip guard node
        next_node = Sequitur.get_rule_rhs(rule_head_node)
        while not Sequitur.is_guard_node(next_node):
            s += "%s " % next_node.get_data()
            next_node = next_node.get_next()
        return s

    @staticmethod
    def get_rule_rhs(lhs_node):
        return lhs_node.get_next().get_next()

    @staticmethod
    def get_rules(start_rule_node):
        rules_todo_list = [start_rule_node]
        rules_done_list = []
        while len(rules_todo_list) > 0:
            rule = rules_todo_list[0]
            rules_done_list.append(rule)
            node = Sequitur.get_rule_rhs(rule)
            if node is None:
                continue
            while not Sequitur.is_guard_node(node):
                rule_ptr = node.get_rule_ptr()
                if rule_ptr is not None and rule_ptr.get_data() not in [n.get_data() for n in rules_todo_list]:
                    rules_todo_list.append(node.get_rule_ptr())
                node = node.get_next()
            rules_todo_list = rules_todo_list[1:]
        return list(set(rules_done_list))

    @staticmethod
    def dedupe_rule_list(rules):
        seen = []
        lst = []
        for obj in rules:
            if obj.get_data() not in seen:
                lst.append(obj)
                seen.append(obj.get_data())
        return lst

    @staticmethod
    def get_digram_key(digram: Digram) -> string:
        return '.'.join([digram.le.get_data(), digram.ri.get_data()])

    def add_digram_to_index(self, digram: Digram):
        if digram.contains_guard_node():
            return
        digram_key = self.get_digram_key(digram)
        ref_node = digram.le
        self.digram_index[digram_key] = ref_node

    @staticmethod
    def create_guard_node(rule_node: Node) -> Node:
        return Node(Sequitur.GUARD_SYMBOL, prevnode=rule_node, is_terminal=False)

    def construct_rule_head(self) -> Node:
        rule_id = Sequitur.get_uid()
        rule_node = Node(rule_id, is_terminal=False)
        guard_node = self.create_guard_node(rule_node)
        rule_node.set_next(guard_node)
        guard_node.set_prev(rule_node)
        return rule_node, guard_node

    @staticmethod
    def is_guard_node(node: Node) -> bool:
        return node.get_data() == Sequitur.GUARD_SYMBOL

    @staticmethod
    def get_rule_end_node(rule_start_node: Node) -> Node:
        # first node is the one past the guard node
        guard_node = rule_start_node.get_next()
        next_node = guard_node
        while not Sequitur.is_guard_node(next_node.get_next()):
            next_node = next_node.get_next()
        return next_node

    def remove_from_index(self, digram: Digram):
        if digram.ri is None:
            return
        if not Sequitur.is_guard_node(digram.ri):
            digram_key = self.get_digram_key(digram)
            self.digram_index.pop(digram_key, None)

    def update_index(self, digram: Digram, ref_node):
        if digram.contains_guard_node():
            return
        self.digram_index[self.get_digram_key(digram)] = ref_node

    @staticmethod
    def get_rule_rhs_data(rule_node: Node):
        curr = Sequitur.get_rule_rhs(rule_node)
        vals = []
        while not Sequitur.is_guard_node(curr.get_next()):
            vals.append(curr.get_data())
            curr = curr.get_next()
        return vals

    @staticmethod
    def index_node_is_rule(index_node):
        if (not index_node.is_terminal()) and Sequitur.is_guard_node(index_node.get_next()):
            return True
        else:
            return False

    @staticmethod
    def rule_exists_for_digram(rule_ref_node: Node, digram: Digram) -> bool:
        digram_ref_node = digram.le
        # in order for a rule to match a digram, the rule must start with the first element, end with the last and
        # have nothing in between. also make sure it is a rule
        if rule_ref_node.get_data() == Sequitur.START_SYMBOL:
            # don't want to match start rule
            return False
        digram_data = [digram_ref_node.get_data(), digram_ref_node.get_next().get_data()]
        rule_data = Sequitur.get_rule_rhs_data(rule_ref_node)
        if len(digram_data) != len(rule_data):
            return False
        return all([digram_data[i] == rule_data[i] for i in range(len(digram_data))])

    def digram_exists(self, digram: Digram) -> bool:
        return self.get_digram_key(digram) in self.digram_index.keys()

    def start_rule_empty(self) -> bool:
        return self.start_rule.get_next().get_next() is None

    def append_to_start_rule(self, new_node: Node):
        if self.start_rule_empty():
            guard_node = self.start_rule.get_next()
            guard_node.set_next(new_node)
            new_node.set_prev(guard_node)
            new_node.set_next(guard_node)
        else:
            end_node = Sequitur.get_rule_end_node(self.start_rule)
            guard_node = end_node.get_next()
            end_node.set_next(new_node)
            new_node.set_prev(end_node)
            new_node.set_next(guard_node)

    def replace_digram_with_rule_symlink(self, rule_node: Node, digram: Digram):
        rule_node_symlink = Node.get_symlink(rule_node)
        prev_node = digram.le.get_prev()  # save prev node in the original  rule
        next_node = digram.ri.get_next()  # save next node in the original rule
        rule_node_symlink.set_next(next_node)
        rule_node_symlink.set_prev(prev_node)
        new_digram_le = Digram(prev_node, rule_node_symlink)
        # link rule symlink in to previous and next nodes
        self.make_link(new_digram_le)
        self.remove_from_index(Digram(prev_node, digram.le))  # break old link in index hash
        new_digram_ri = Digram(rule_node_symlink, next_node)
        self.make_link(new_digram_ri)
        self.remove_from_index(Digram(digram.ri, next_node))  # break old link in index table
        # now place digram in rule
        self.update_index(digram, rule_node)
        # return this symlink for posterity
        return rule_node_symlink

    def create_new_rule(self, index_node: Node) -> Node:
        index_digram = Digram(index_node, index_node.get_next())
        rule_node, guard_node = self.construct_rule_head()
        self.replace_digram_with_rule_symlink(rule_node, index_digram)
        # link new rule to digram
        guard_node.set_next(index_digram.le)
        index_digram.le.set_prev(guard_node)
        # create 'loop-around' from end of rule to guard
        index_digram.ri.set_next(rule_node.get_next())
        return rule_node

    def make_link(self, digram: Digram):
        # keep track of what is considered the 'current node' to return for linking to ensuing nodes
        curr_node = digram.ri
        digram.le.set_next(digram.ri)
        # a guard node should maintain the rule head node as its previous node
        if not Sequitur.is_guard_node(digram.ri):
            digram.ri.set_prev(digram.le)
        if not self.digram_exists(digram):
            # add digram to index
            self.add_digram_to_index(digram)
        else:
            index_node = self.digram_index[self.get_digram_key(digram)]
            if index_node.get_next().get_nodeid() == digram.le.get_nodeid():
                # enforce constraint that a new rule cannot be built twice in succession
                return curr_node
            if not Sequitur.index_node_is_rule(index_node):
                # the index node points to a previous location in the start rule and not to a digram rule,
                # so create one. and in so doing, replace the previous instance with it
                rule_node = self.create_new_rule(index_node)
            else:
                rule_node = index_node
            rule_node_symlink = self.replace_digram_with_rule_symlink(rule_node, digram)
            # we've changed what is the 'current node' because we've replaced it with a rule symlink
            curr_node = rule_node_symlink
        return curr_node

    def consume_sequence(self, seq_vals: list):
        left_node = Node(seq_vals[0], is_terminal=True)
        self.append_to_start_rule(left_node)
        for i in range(1, len(seq_vals)):
            right_node = Node(seq_vals[i], is_terminal=True)
            self.append_to_start_rule(right_node)
            digram = Digram(left_node, right_node)
            print("%s | %s\n" % (' '.join(seq_vals[:(i+1)]), ' '.join(seq_vals[(i+1):])))
            left_node = self.make_link(digram)
            self.print_grammar_string()
            #left_node = right_node

    @staticmethod
    def run(seq: list):
        s = Sequitur()
        s.consume_sequence(seq)
        #s.print_grammar_string()


if __name__ == '__main__':
    #seq = list('abcdbc')
    seq = list('ababababab')
    Sequitur.run(seq)
    print("done")
