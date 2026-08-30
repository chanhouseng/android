from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import re
import random
from urllib.parse import parse_qs, urlparse, quote

PORT = 8080

SKILL_NAMES = [
    "Information Network Cabling",
    "Industrial Mechanics",
    "Mechanical Engineering CAD",
    "CNC Milling",
    "IT Software Solutions for Business",
    "Mechatronics",
    "Mobile Applications Development"
]

SKILL_INTROS = [
    "The occupations related to this skill are deeply related to the technology that supports modern information societies.",
    "This field focuses on designing, installing, and maintaining complex mechanical and automated manufacturing systems.",
    "Engineers in this domain solve complex technical challenges using modern computer-aided design software.",
    "Software solutions in this area power enterprise operations and modern business infrastructure."
]

class MockRequestHandler(BaseHTTPRequestHandler):

    def _send_json_response(self, status_code, body):
        """Helper to send JSON responses."""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json;charset=UTF-8')
        self.end_headers()
        self.wfile.write(json.dumps(body).encode('utf-8'))

    def _get_request_body(self):
        """Helper to parse request body depending on content-type."""
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            return {}
        
        raw_data = self.rfile.read(content_length).decode('utf-8')
        content_type = self.headers.get('Content-Type', '')

        if 'application/json' in content_type:
            try:
                return json.loads(raw_data)
            except json.JSONDecodeError:
                return {}
        else:
            parsed_data = parse_qs(raw_data)
            return {k: v[0] if len(v) == 1 else v for k, v in parsed_data.items()}

    def do_GET(self):
        parsed_path = urlparse(self.path).path

        # GET /api/image/photos/<filename> (Redirects/Responds with placeholder image URL)
        if parsed_path.startswith('/api/image/photos/'):
            filename = parsed_path.split('/')[-1]
            placeholder_url = f"https://placehold.co/600x400?text={quote(filename)}"
            
            # Redirect browser/client directly to the placeholder image
            self.send_response(302)
            self.send_header('Location', placeholder_url)
            self.end_headers()

        # GET /api/skills-types
        elif parsed_path == '/api/skills-types':
            response = {
                "code": 200,
                "msg": "Success",
                "data": [
                    {
                        "skillTypeId": 0,
                        "name": "Manufacturing and Engineering Technology",
                        "skills": {
                            "0000": "Industrial Mechanics",
                            "0001": "Manufacturing Team Challenge",
                            "0002": "Mechatronics",
                            "0003": "Mechanical Engineering CAD",
                            "0004": "CNC Turning",
                            "0005": "CNC Milling"
                        }
                    },
                    {
                        "skillTypeId": 1,
                        "name": "Information and Communication Technology",
                        "skills": {
                            "1000": "Information Network Cabling",
                            "1001": "IT Software Solutions for Business"
                        }
                    }
                ]
            }
            self._send_json_response(200, response)

        # GET /api/skills/:id (Dynamic output based on ID)
        elif re.match(r'^/api/skills/([^/]+)$', parsed_path):
            skill_id = parsed_path.split('/')[-1]
            seed_val = hash(skill_id)
            rng = random.Random(seed_val)

            if skill_id == "1000":
                name = "Information Network Cabling"
                intro = "The occupations related to “Information Network Cabling” are deeply related to the technology that supports modern information societies in which lives can be more comfortable and sustainable."
            else:
                name = rng.choice(SKILL_NAMES)
                intro = rng.choice(SKILL_INTROS)

            img_filename = f"{skill_id}.jpg"

            response = {
                "code": 200,
                "msg": "Success",
                "data": {
                    "id": skill_id,
                    "name": name,
                    "introduction": intro,
                    "img": f"https://placehold.co/600x400?text={quote(img_filename)}"
                }
            }
            self._send_json_response(200, response)

        # GET /api/video
        elif parsed_path == '/api/video':
            response = {
                "code": 200,
                "msg": "Success",
                "data": [
                    {
                        "uuid": "2D6A33E7-AE3C-FCFA-5AF1-249C71C1AC57",
                        "name": "Welcome to WorldSkills 2022 in Shanghai",
                        "url": "http://localhost:8080/apivideo/ws_welcome.mp4",
                        "length": 134468
                    }
                ]
            }
            self._send_json_response(200, response)

        # GET /api/video/comment
        elif parsed_path == '/api/video/comment':
            response = {
                "code": 200,
                "msg": "Success",
                "data": [
                    {
                        "uuid": "8985550e-e29e-466c-88e3-bb6f0730e7bf",
                        "ipAddress": "127.0.0.1",
                        "commentText": "This is a new video.",
                        "commentTime": 1653292873166,
                        "videoUUID": "2D6A33E7-AE3C-FCFA-5AF1-249C71C1AC57"
                    }
                ]
            }
            self._send_json_response(200, response)

        else:
            self._send_json_response(404, {"code": 404, "msg": "Not Found", "data": None})

    def do_POST(self):
        parsed_path = urlparse(self.path).path
        body = self._get_request_body()

        # POST /api/image/photos
        if parsed_path == '/api/image/photos':
            page_number = body.get('pageNumber')

            if page_number is not None and str(page_number) != '':
                if str(page_number) == '0':
                    response = {
                        "code": 200,
                        "msg": "Success",
                        "data": [
                            {"visit-count": "389", "heat": "1004", "url": f"https://placehold.co/600x400?text={quote('No_00009.jpg')}"},
                            {"visit-count": "249", "heat": "2699", "url": f"https://placehold.co/600x400?text={quote('No_00010.jpg')}"},
                            {"visit-count": "296", "heat": "1934", "url": f"https://placehold.co/600x400?text={quote('No_00011.jpg')}"},
                            {"visit-count": "358", "heat": "1402", "url": f"https://placehold.co/600x400?text={quote('No_00012.jpg')}"},
                            {"visit-count": "207", "heat": "2976", "url": f"https://placehold.co/600x400?text={quote('No_00013.jpg')}"},
                            {"visit-count": "398", "heat": "1116", "url": f"https://placehold.co/600x400?text={quote('No_00014.jpg')}"},
                            {"visit-count": "229", "heat": "2367", "url": f"https://placehold.co/600x400?text={quote('No_00015.jpg')}"},
                            {"visit-count": "322", "heat": "2326", "url": f"https://placehold.co/600x400?text={quote('No_00016.jpg')}"},
                            {"visit-count": "335", "heat": "1138", "url": f"https://placehold.co/600x400?text={quote('No_00017.jpg')}"}
                        ]
                    }
                    self._send_json_response(200, response)
                else:
                    response = {
                        "code": 400,
                        "msg": "PageNumber out of limit.",
                        "data": None
                    }
                    self._send_json_response(400, response)
            else:
                response = {
                    "code": 200,
                    "msg": "Success",
                    "data": {
                        "firstPageNumber": 0,
                        "totalPhotos": 18,
                        "totalPage": 2
                    }
                }
                self._send_json_response(200, response)

        # POST /api/video/comment
        elif parsed_path == '/api/video/comment':
            comment_text = body.get('commentText')
            video_uuid = body.get('videoUUID')
            valid_uuid = "2D6A33E7-AE3C-FCFA-5AF1-249C71C1AC57"

            if video_uuid == valid_uuid:
                response = {
                    "code": 200,
                    "msg": "Success",
                    "data": {
                        "uuid": "fa187f4f-2260-4aa9-b2bd-9ab40fa7f939",
                        "ipAddress": self.client_address[0] if self.client_address else "127.0.0.1",
                        "commentText": comment_text,
                        "commentTime": 1653292907527,
                        "videoUUID": video_uuid
                    }
                }
                self._send_json_response(200, response)
            else:
                response = {
                    "code": 400,
                    "msg": "No video of this UUID can be found.",
                    "data": None
                }
                self._send_json_response(400, response)

        else:
            self._send_json_response(404, {"code": 404, "msg": "Not Found", "data": None})


def run(server_class=HTTPServer, handler_class=MockRequestHandler):
    server_address = ('', PORT)
    httpd = server_class(server_address, handler_class)
    print(f"Server running on http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()

if __name__ == '__main__':
    run()