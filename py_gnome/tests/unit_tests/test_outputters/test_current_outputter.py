'''
tests for geojson outputter
'''
from pprint import PrettyPrinter
pp = PrettyPrinter(indent=2, width=120)

from datetime import datetime

import numpy as np
import pytest

# from gnome.basic_types import oil_status
from gnome.utilities import time_utils

from gnome.environment import Tide
from gnome.spill import SpatialRelease, Spill, point_line_release_spill
from gnome.movers import CatsMover
from gnome.outputters import CurrentGridGeoJsonOutput

from ..conftest import testdata


td = Tide(filename=testdata['CatsMover']['tide'])
c_cats = CatsMover(testdata['CatsMover']['curr'], tide=td)


rel_time = datetime(2012, 9, 15, 12)
time_step = 15 * 60  # seconds
model_time = time_utils.sec_to_date(time_utils.date_to_sec(rel_time))


@pytest.fixture(scope='function')
def model(sample_model, output_dir):
    model = sample_model['model']
    rel_start_pos = sample_model['release_start_pos']
    rel_end_pos = sample_model['release_end_pos']

    model.cache_enabled = True
    model.uncertain = True

    N = 10  # a line of ten points
    line_pos = np.zeros((N, 3), dtype=np.float64)
    line_pos[:, 0] = np.linspace(rel_start_pos[0], rel_end_pos[0], N)
    line_pos[:, 1] = np.linspace(rel_start_pos[1], rel_end_pos[1], N)

    # print start_points
    model.environment += td

    model.spills += point_line_release_spill(1,
                                             start_position=rel_start_pos,
                                             release_time=model.start_time,
                                             end_position=rel_end_pos)

    release = SpatialRelease(start_position=line_pos,
                             release_time=model.start_time)

    model.spills += Spill(release)

    model.movers += c_cats

    model.outputters += CurrentGridGeoJsonOutput(c_cats)

    model.rewind()

    return model


def test_init():
    'simple initialization passes'
    g = CurrentGridGeoJsonOutput(c_cats)
    assert g.current_mover == c_cats


def test_current_grid_geojson_output(model):
    '''
        test geojson outputter with a model since simplest to do that
    '''
    # default is to round data
    model.rewind()

    for step in model:
        assert 'CurrentGridGeoJsonOutput' in step
        assert 'step_num' in step['CurrentGridGeoJsonOutput']
        assert 'time_stamp' in step['CurrentGridGeoJsonOutput']
        assert 'feature_collection' in step['CurrentGridGeoJsonOutput']

        fc = step['CurrentGridGeoJsonOutput']['feature_collection']
        assert 'type' in fc
        assert fc['type'] == 'FeatureCollection'
        assert 'features' in fc
        assert len(fc['features']) > 0

        for feature in fc['features']:
            assert 'type' in feature
            assert feature['type'] == 'Feature'

            assert 'properties' in feature
            assert 'velocity' in feature['properties']

            assert 'geometry' in feature
            assert len(feature['geometry']) > 0

            geometry = feature['geometry']
            assert 'type' in geometry
            assert geometry['type'] == 'Point'

            assert 'coordinates' in geometry
            assert len(geometry['coordinates']) == 2