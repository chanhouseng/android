<?php

namespace App\Models;

use CodeIgniter\Model;

class ParticipantModel extends Model
{
    protected $table = 'participants';
    protected $primaryKey = 'id';
    protected $allowedFields = ['activityId', 'partcipantName', 'participantTrade', 'participantRole'];

}