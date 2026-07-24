<?php

namespace App\Controllers;

class LoginController extends BaseController
{
    public function index()
    {

        
        // Set the validation rules
        $name = $this->request->getPost('name');
        $pwd = $this->request->getPost('pwd');

        // Get the header value
        $accessToken = $this->request->getHeader('accessToken', TRUE);

        
        if (($name != "user" && $pwd != "1234" ) ) {
            // Validation failed, re-display the form
            return $this->response->setContentType('application/json')->setBody(json_encode(['validated' => FALSE]));
        } 

        $user = [
            'username' => "王茗然",
            'role' => "学生志愿者",
            'thumbnail' => "profile/user.jpg"
        ];

        return $this->response->setContentType('application/json')->setBody(json_encode(['validated' => TRUE, 
        'user' => $user]));
    }
}
