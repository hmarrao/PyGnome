import glob
import datetime
import os
import uuid


class DoesNotExist(Exception):
    pass


class ModelManager(object):
    """
    An object that manages a pool of in-memory `py_gnome.model.Model` instances
    in a dictionary.
    """
    DoesNotExist = DoesNotExist

    def __init__(self):
        self.running_models = {}

    def create(self):
        model = MockModel()
        self.running_models[model.id] = model
        return model

    def get_or_create(self, model_id):
        """
        Return a running `py_gnome.model.Model` instance if the user has a valid
        `model_id` key in his or her session. Otherwise, create a new model and
        return it.
        """
        model = None
        created = False

        if model_id:
            model = self.running_models.get(model_id, None)

        if model is None:
            model = self.create()
            created = True

        return model, created

    def get(self, model_id):
        if not model_id in self.running_models:
            raise self.DoesNotExist
        return self.running_models.get(model_id)

    def add(self, model_id, model):
        self.running_models[model_id] = model

    def delete(self, model_id):
        self.running_models.pop(model_id, None)

    def exists(self, model_id):
        return model_id in self.running_models


class MockModel(object):
    """
    A mock stand-in for `py_gnome.model.Model`.
    """
    def __init__(self):
        self.id = uuid.uuid4()
        self.movers = {}
        self.spills = {}

    def get_movers(self):
        return self.movers

    def get_mover(self, mover_id):
        mover_id = self.get_uuid(mover_id)
        return self.movers.get(mover_id, None)

    def get_settings(self):
        return [
            self.make_object_from_dict({'name': 'ID', 'value': self.id})
        ]

    def has_map(self):
        return True

    def get_map(self):
        return self.make_object_from_dict({'name': 'My map'})

    def get_spills(self):
        return self.spills

    def get_uuid(self, id):
        return uuid.UUID(id)

    def make_object_from_dict(self, data):
        """
        XXX: Mock out having Mover, Spill and Setting classes by converting
        `data` dict into an object.
        """
        return type('Mover', (object,), data)()

    def has_mover_with_id(self, mover_id):
        mover_id = self.get_uuid(mover_id)
        return mover_id in self.movers

    def add_mover(self, data):
        mover_id = uuid.uuid4()
        self.movers[mover_id] = self.make_object_from_dict(data)
        return mover_id

    def update_mover(self, mover_id, data):
        mover_id = self.get_uuid(mover_id)
        if mover_id in self.movers:
            self.movers[mover_id] = self.make_object_from_dict(data)
            return True
        return False

    def delete_mover(self, mover_id):
        mover_id = self.get_uuid(mover_id)
        if mover_id in self.movers:
            del self.movers[mover_id]

    def get_mover_title(self, mover):
        """
        Return an appropriate title for `mover`.
        TODO: This is a stub method that belongs on a "Mover" class.
        """
        abbrev = 'kt'
        if mover.speed_type == 'miles':
            abbrev = 'mi/hr'
        elif mover.speed_type == 'meters':
            abbrev = 'mt/sec'

        return '%s: %s %s %s' % (
            mover.type.replace('_', ' ').title(),
            mover.speed, abbrev, mover.direction
        )

    def run(self):
        frames_glob = os.path.join(
            os.path.dirname(__file__), 'static', 'img', 'test_frames', '*.jpg')
        images = glob.glob(frames_glob)

        # Mock out some timestamps until we accept this input from the user.
        two_weeks_ago = datetime.datetime.now() - datetime.timedelta(weeks=4)

        timestamps = [two_weeks_ago + datetime.timedelta(days=day_num)
                      for day_num in range(len(images))]

        return [
            dict(url=image.split('webgnome')[-1], timestamp=timestamps[i])
            for i, image in enumerate(images)]