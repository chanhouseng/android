<?php

namespace App\Controllers;

use App\Models\EventModel;
use CodeIgniter\Controller;

class EventController extends Controller
{
    protected $model;

    public function __construct()
    {
        $this->model = new EventModel();
    }

    // Display all events
    public function index()
    {
        $data['events'] = $this->model->findAll();
        return $this->response->setContentType('application/json')->setBody(json_encode($data, JSON_UNESCAPED_UNICODE));
    }

    // Display a events
    public function get($id) 
    {
        $data['events'] = $this->model->find($id);
        return $this->response->setContentType('application/json')->setBody(json_encode($data, JSON_UNESCAPED_UNICODE));
    }    

    // Store new event in database
    public function store()
    {
        $event = [
            'title' => $this->request->getVar('title'),
            'description' => $this->request->getVar('description'),
            'date' => $this->request->getVar('date')
        ];
        $this->model->save($event);
        return $this->response->setStatusCode(201)->setContentType('application/json')->setBody(json_encode(['message' => 'Event created successfully', 'event' => $event]));
    }

    // Update event in database
    public function update($id)
    {
        $event = [
            'title' => $this->request->getVar('title'),
            'description' => $this->request->getVar('description'),
            'date' => $this->request->getVar('date')
        ];
        $this->model->update($id, $event);
        return $this->response->setContentType('application/json')->setBody(json_encode(['message' => 'Event updated successfully', 'event' => $event]));
    }

    // Delete an event
    public function delete($id)
    {
        $this->model->delete($id);
        return $this->response->setStatusCode(200)->setContentType('application/json')->setBody(json_encode(['message' => 'Event deleted successfully']));
    }
}