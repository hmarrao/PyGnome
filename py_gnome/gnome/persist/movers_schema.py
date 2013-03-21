'''
Created on Mar 1, 2013
'''

from colander import (
    SchemaNode,
    MappingSchema,
    Bool,
    Float,
    String,
    TupleSchema,
    drop
    )

import gnome
from gnome.persist.validators import convertable_to_seconds
from gnome.persist.base_schema import Id, WorldPoint
from gnome.persist.extend_colander import LocalDateTime


class Mover(MappingSchema):
    on = SchemaNode(Bool(), default=True, missing=True)
    active_start = SchemaNode(LocalDateTime(), default=None, missing=None,
                              validator=convertable_to_seconds)
    active_stop = SchemaNode(LocalDateTime(), default=None, missing=None,
                             validator=convertable_to_seconds)

class WindMover(Id, Mover):
    """
    Contains properties required by UpdateWindMover and CreateWindMover
    """
    uncertain_duration = SchemaNode(Float() )
    uncertain_time_delay = SchemaNode(Float() )
    uncertain_speed_scale = SchemaNode(Float() )
    uncertain_angle_scale = SchemaNode(Float() )
    wind_id = SchemaNode(String(), missing=drop)    # only used to create new WindMover
    
class UpdateRandomMover(Id, Mover):
    diffusion_coef = SchemaNode( Float() )
        
class SimpleMoverVelocity(TupleSchema):
    vel_x = SchemaNode( Float() )
    vel_y = SchemaNode( Float() )
    vel_z = SchemaNode( Float() )

class SimpleMover(Id, Mover):
    uncertainty_scale = SchemaNode( Float() )
    velocity = SimpleMoverVelocity()
        
class CatsMover( Id, Mover):
    """
    Contains properties required by UpdateWindMover and CreateWindMover
    """
    filename = SchemaNode(String() )
    scale = SchemaNode(Bool() )
    scale_refpoint = WorldPoint()
    scale_value = SchemaNode(Float() )
    tide_id = SchemaNode(String(), missing=drop)    # can have CatsMover without Tide object
    

#===============================================================================
# class UpdateWindMover(Mover):
#    """
#    Contains properties required by UpdateWindMover and CreateWindMover
#    """
#    uncertain_duration = SchemaNode(Float() )
#    uncertain_time_delay = SchemaNode(Float() )
#    uncertain_speed_scale = SchemaNode(Float() )
#    uncertain_angle_scale = SchemaNode(Float() )
#    wind_id = SchemaNode(String() )
#    
# 
# class CreateWindMover(Id, UpdateWindMover):
#    pass
# 
# class UpdateRandomMover(Mover):
#    diffusion_coef = SchemaNode( Float() )
#    
# class CreateRandomMover(Id,UpdateRandomMover):
#    pass
#    
# class SimpleMoverVelocity(TupleSchema):
#    vel_x = SchemaNode( Float() )
#    vel_y = SchemaNode( Float() )
#    vel_z = SchemaNode( Float() )
# 
# class UpdateSimpleMover(Mover):
#    uncertainty_scale = SchemaNode( Float() )
#    velocity = SimpleMoverVelocity()
#    
# class CreateSimpleMover(Id, UpdateSimpleMover):
#    pass
# 
# class WorldPoint(TupleSchema):
#    long = SchemaNode( Float() )
#    lat = SchemaNode( Float() )
#    z = SchemaNode( Float(), default=0.0)
#    
# class UpdateCatsMover(Mover):
#    """
#    Contains properties required by UpdateWindMover and CreateWindMover
#    """
#    filename = SchemaNode(String() )
#    scale = SchemaNode(Bool() )
#    scale_refpoint = WorldPoint()
#    scale_value = SchemaNode(Float() )
#    tide_id = SchemaNode(String(), missing=drop)    # can have CatsMover without Tide object
#    
# 
# class CreateCatsMover(Id, UpdateCatsMover):
#    pass
#===============================================================================
