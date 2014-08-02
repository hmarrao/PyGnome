import os

cimport numpy as cnp
import numpy as np

from type_defs cimport *
from movers cimport Mover_c
from current_movers cimport CATSMover_c
from cy_current_mover cimport CyCurrentMover, dc_mover_to_cmover

from gnome import basic_types
from gnome.cy_gnome.cy_ossm_time cimport CyOSSMTime
from gnome.cy_gnome.cy_shio_time cimport CyShioTime
from gnome.cy_gnome.cy_helpers import filename_as_bytes

"""
Dynamic casts are not currently supported in Cython - define it here instead.
Since this function is custom for each mover, just keep it with the definition
for each mover
"""
cdef extern from *:
    CATSMover_c* dynamic_cast_ptr "dynamic_cast<CATSMover_c *>" \
        (Mover_c *) except NULL


cdef class CyCatsMover(CyCurrentMover):

    cdef CATSMover_c *cats

    def __cinit__(self):
        'No plans to subclass CATSMover so no check to see if called by child'
        self.mover = new CATSMover_c()
        print 'CATSMover_c.__cinit__: created self.mover'
        self.curr_mover = dc_mover_to_cmover(self.mover)
        self.cats = dynamic_cast_ptr(self.mover)

    def __dealloc__(self):
        # since this is allocated in this class, free memory here as well
        del self.mover
        print 'CATSMover_c.__dealloc__: deleted self.mover'
        self.mover = NULL
        self.curr_mover = NULL
        self.cats = NULL

    def __init__(self, scale_value=1,
                 uncertain_eddy_diffusion=0, uncertain_eddy_v0=.1,
                 ref_point=None, **kwargs):
        """
        Initialize the CyCatsMover which sets the properties for the underlying
        C++ CATSMover_c object

        :param scale_type=0: There are 3 options in c++, however only
                             two options are used:
                             - SCALE_NONE = 0
                             - SCALE_CONSTANT = 1
                             The python CatsMover wrapper sets only 0 or 1.
                             Default is NONE.
        :param scale_value=1: The value by which to scale the data.
                              By default, this is 1 which means no scaling
        :param uncertain_duration: how often does a given uncertain element
                                   get reset
        :param uncertain_time_delay: when does the uncertainly kick in.
        :param up_cur_uncertain: Scale for uncertainty along the flow
        :param down_cur_uncertain: Scale for uncertainty along the flow
        :param right_cur_uncertain: Scale for uncertainty across the flow
        :param left_cur_uncertain: Scale for uncertainty across the flow
        :param uncertain_eddy_diffusion: Diffusion coefficient for
                                         eddy diffusion. Default is 0.
        :param uncertain_eddy_v0: Default is .1 (Check that this is still used)
        :param ref_point: Reference point used by C++ CATSMover_c
                          Default (long, lat, z) = (0., 0., -999)
        """
        # If scale_value = 1, then scaleType is essentially None since scaling
        # by 1 doesn't do anything. So always set scaleType to be 1
        self.cats.scaleType = 1
        self.cats.scaleValue = scale_value
        self.cats.fEddyDiffusion = uncertain_eddy_diffusion

        if not ref_point:
            # defaults (-999, -999, -999)
            ref_point = (0., 0., -999)

        if not isinstance(ref_point, (list, tuple)) or len(ref_point) != 3:
            raise ValueError('CyCatsMover.__init__(): ref_point needs to be '
                             'in the format (long, lat, z)')

        self.ref_point = ref_point
        super(CyCatsMover, self).__init__(**kwargs)
        ## should not have to do this manually.
        ## make-shifting for now.
        #self.cats.fOptimize.isOptimizedForStep = 0
        #self.cats.fOptimize.isFirstStep = 1

    property scale_value:
        def __get__(self):
            return self.cats.scaleValue

        def __set__(self, value):
            self.cats.scaleValue = value

    property uncertain_eddy_diffusion:
        def __get__(self):
            return self.cats.fEddyDiffusion

        def __set__(self, value):
            self.cats.fEddyDiffusion = value

    property uncertain_eddy_v0:
        def __get__(self):
            return self.cats.fEddyV0

        def __set__(self, value):
            self.cats.fEddyV0 = value

    property ref_point:
        def __get__(self):
            """
            returns the tuple containing (long, lat, z) of reference point
            if it is defined either by the user or obtained from the
            Shio object; otherwise it returns None

            TODO: make sure this is consistent with the format of
                  CyShioTime.ref_point
            """
            if self.cats.refZ == -999:
                return None
            else:
                return (self.cats.refP.pLong / 1.e6,
                        self.cats.refP.pLat / 1.e6,
                        self.cats.refZ)

        def __set__(self, ref_point):
            """
            accepts a list or a tuple
            will not work with a numpy array since indexing assumes a list
            or a tuple

            takes only (long, lat, z), if length is bigger than 3, it uses the
            first 3 data points

            TODO: make sure this is consistent with the format of
                  CyShioTime.ref_point
            """
            cdef WorldPoint3D pos

            pos.p.pLong = ref_point[0] * 10 ** 6  # should this happen in C++?
            pos.p.pLat = ref_point[1] * 10 ** 6
            pos.z = ref_point[2]

            self.cats.SetRefPosition(pos)

    def __repr__(self):
        """
        Return an unambiguous representation of this object so it can be
        recreated

        Probably want to return filename as well
        """
        b_repr = super(CyCatsMover, self).__repr__()
        c_repr = b_repr[:-1] + ('scale_value={0.scale_value}, '
                                'uncertain_eddy_diffusion='
                                '{0.uncertain_eddy_diffusion})').format(self)
        return c_repr

    def __str__(self):
        """Return string representation of this object"""
        b_str = super(CyCatsMover, self).__str__()
        c_str = b_str + ('  scale value = {0.scale_value}\n'
                         '  eddy diffusion coef={0.uncertain_eddy_diffusion}\n'
                         .format(self))
        return c_str

    def __reduce__(self):
        b_reduce = super(CyCatsMover, self).__reduce__()
        props = [self.uncertain_eddy_diffusion,
                 self.uncertain_eddy_v0,
                 self.ref_point,
                 self.scale_value]
        for prop in b_reduce[1]:
            props.append(prop)

        return (CyCatsMover, tuple(props))

    def set_shio(self, CyShioTime cy_shio):
        """
        Takes a CyShioTime object as input and sets C++ Cats mover properties
        from the Shio object.
        """
        self.cats.SetTimeDep(cy_shio.shio)
        self.ref_point = cy_shio.station_location
        self.cats.bTimeFileActive = True
        self.cats.scaleType = 1
        return True

    def set_ossm(self, CyOSSMTime ossm):
        """
        Takes a CyOSSMTime object as input and sets C++ Cats mover properties
        from the OSSM object.
        """
        self.cats.SetTimeDep(ossm.time_dep)
        self.cats.bTimeFileActive = True   # What is this?
        return True

    def text_read(self, fname):
        """
        read the current file
        """
        cdef OSErr err
        path_ = filename_as_bytes(fname)
        err = self.cats.TextRead(path_)
        if err != False:
            raise ValueError('CATSMover.text_read(..) returned an error. '
                             'OSErr: {0}'.format(err))
        return True

    def get_move(self,
                 model_time,
                 step_len,
                 cnp.ndarray[WorldPoint3D, ndim=1] ref_points,
                 cnp.ndarray[WorldPoint3D, ndim=1] delta,
                 cnp.ndarray[short] LE_status,
                 LEType spill_type):
        """
        .. function:: get_move(self,
                 model_time,
                 step_len,
                 cnp.ndarray[WorldPoint3D, ndim=1] ref_points,
                 cnp.ndarray[WorldPoint3D, ndim=1] delta,
                 cnp.ndarray[cnp.npy_double] windages,
                 cnp.ndarray[short] LE_status,
                 LEType LE_type)

        Invokes the underlying C++ WindMover_c.get_move(...)

        :param model_time: current model time
        :param step_len: step length over which delta is computed
        :param ref_points: current locations of LE particles
        :type ref_points: numpy array of WorldPoint3D
        :param delta: the change in position of each particle over step_len
        :type delta: numpy array of WorldPoint3D
        :param LE_windage: windage to be applied to each particle
        :type LE_windage: numpy array of numpy.npy_int16
        :param le_status: Status of each particle - movement is only on
                          particles in water
        :param spill_type: LEType defining whether spill is forecast
                           or uncertain
        :returns: none
        """
        cdef OSErr err

        N = len(ref_points)

        err = self.cats.get_move(N, model_time, step_len,
                                 &ref_points[0], &delta[0], &LE_status[0],
                                 spill_type, 0)
        if err == 1:
            raise ValueError('Make sure numpy arrays for ref_points, delta, '
                             'and windages are defined')

        """
        Can probably raise this error before calling the C++ code
        - but the C++ also throwing this error
        """
        if err == 2:
            raise ValueError('The value for spill type can only be '
                             '"forecast" or "uncertainty" '
                             '- you have chosen: {0!s}'.format(spill_type))

    #==========================================================================
    # TODO: What are these used for
    # def compute_velocity_scale(self, model_time):
    #    self.mover.ComputeVelocityScale(model_time)
    #
    # def set_velocity_scale(self, scale_value):
    #    self.mover.refScale = scale_value
    #==========================================================================
