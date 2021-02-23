#"pin0" is used here to avoid import and mess up AC
def play(_source_,wait=True,pin="pin0",return_pin=None):
    return
def is_playing():
    return True
def stop():
    return

class __AudioFrame(list):
    def __init__(self):
        for i in range(32):
            self.append(0)

AudioFrame=__AudioFrame()