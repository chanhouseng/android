<?php

namespace App\Controllers;

use App\Models\TourModel;
use CodeIgniter\Controller;

class TourController extends Controller
{
    protected $model;

    public function __construct()
    {
        $this->model = new TourModel();
    }

    // Display all tours
    public function index()
    {
        $data['tours'] = $this->model->findAll();
        return $this->response->setContentType('application/json')->setBody(json_encode($data, JSON_UNESCAPED_UNICODE));
    }

    // Display a tour
    public function get($id) 
    {
        $data['tours'] = $this->model->find($id);
        return $this->response->setContentType('application/json')->setBody(json_encode($data, JSON_UNESCAPED_UNICODE));
    }    

    // Store new tour in database
    public function store()
    {
        $datei = strtotime($this->request->getVar('activityDate'));
        $date = date("Y-m-d", $datei);
        $tour = [
            'activityName' => $this->request->getVar('activityName'),
            'activityDate' => $date,
            'activityType' => $this->request->getVar('activityType'),
            'activityDescription' => $this->request->getVar('activityDescription'),
            'maxParticipant' => $this->request->getVar('maxParticipant'),
            'joinedParticipant' => 0,
            'presentNo' => 0,
            'absentNo' => 0
        ];
        $this->model->save($tour);
        return $this->response->setStatusCode(201)->setContentType('application/json')->setBody(json_encode(['message' => 'Event created successfully', 'tour' => $tour]));
    }

    // Update tour in database
    public function update($id)
    {
        $data = [
            'isActive' => $this->request->getVar('isActive')
        ];
        $this->model->update($id, $data);

        return $this->response->setContentType('application/json')->setBody(json_encode(['message' => 'Event updated successfully', 'data' => $data]));
    }

    // Delete an event
    public function delete($id)
    {
        $this->model->delete($id);
        return $this->response->setStatusCode(200)->setContentType('application/json')->setBody(json_encode(['message' => 'Event deleted successfully']));
    }
}