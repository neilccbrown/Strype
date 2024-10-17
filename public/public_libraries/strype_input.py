import strype_input_internal as _strype_input_internal
import collections as _collections

def consume_last_click():
    return _strype_input_internal.consumeLastClick()

def pressed_keys():
    return _collections.defaultdict(lambda: False, _strype_input_internal.getPressedKeys())
