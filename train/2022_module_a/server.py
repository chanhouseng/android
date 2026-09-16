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
    "uuid": "3A7B44F8-BE2D-4CFA-8BF2-129C81D2BC61",
    "name": "Welcome to WorldSkills 2022 in Shanghai",
    "url": "https://uploads.video-commander.com/sample/BigBuckBunny.mp4",
    "length": 596000
  },
  {
    "uuid": "4B8C55A9-CF3E-5DFB-9CA3-230D92E3CD72",
    "name": "Introduction to WorldSkills Competition",
    "url": "https://uploads.video-commander.com/sample/BigBuckBunny.mp4",
    "length": 596000
  },
  {
    "uuid": "5C9D66BA-D04F-6EAC-ADB4-341EA3F4DE83",
    "name": "Meet the WorldSkills Competitors",
    "url": "https://uploads.video-commander.com/sample/BigBuckBunny.mp4",
    "length": 596000
  },
  {
    "uuid": "6DAE77CB-E150-7FBD-BEC5-452FB405EF94",
    "name": "WorldSkills Opening Ceremony",
    "url": "https://uploads.video-commander.com/sample/BigBuckBunny.mp4",
    "length": 596000
  },
  {
    "uuid": "7EBF88DC-F261-80CE-CFD6-5630C516F0A5",
    "name": "Discover Web Technologies",
    "url": "https://uploads.video-commander.com/sample/BigBuckBunny.mp4",
    "length": 596000
  },
  {
    "uuid": "8FC099ED-A372-91DF-D0E7-6741D627A1B6",
    "name": "Web Development Skills Introduction",
    "url": "https://uploads.video-commander.com/sample/BigBuckBunny.mp4",
    "length": 596000
  },
  {
    "uuid": "90D1AAFE-B483-A2E0-E1F8-7852E738B2C7",
    "name": "Building Your First Website",
    "url": "https://uploads.video-commander.com/sample/BigBuckBunny.mp4",
    "length": 596000
  },
  {
    "uuid": "A1E2BB0F-C594-B3F1-F209-8963F849C3D8",
    "name": "Introduction to HTML and CSS",
    "url": "https://uploads.video-commander.com/sample/BigBuckBunny.mp4",
    "length": 596000
  },
  {
    "uuid": "B2F3CC10-D6A5-C402-A31A-9074095AD4E9",
    "name": "JavaScript for Beginners",
    "url": "https://uploads.video-commander.com/sample/BigBuckBunny.mp4",
    "length": 596000
  },
  {
    "uuid": "C304DD21-E7B6-D513-B42B-A1851A6BE5FA",
    "name": "Responsive Web Design",
    "url": "https://uploads.video-commander.com/sample/BigBuckBunny.mp4",
    "length": 596000
  },
  {
    "uuid": "D415EE32-F8C7-E624-C53C-B2962B7CF60B",
    "name": "WorldSkills Training Day",
    "url": "https://uploads.video-commander.com/sample/BigBuckBunny.mp4",
    "length": 596000
  },
  {
    "uuid": "E526FF43-A9D8-F735-D64D-C3A73C8D071C",
    "name": "Preparing for the Competition",
    "url": "https://uploads.video-commander.com/sample/BigBuckBunny.mp4",
    "length": 596000
  },
  {
    "uuid": "F6370054-BAE9-0846-E75E-D4B84D9E182D",
    "name": "Competition Day Highlights",
    "url": "https://uploads.video-commander.com/sample/BigBuckBunny.mp4",
    "length": 596000
  },
  {
    "uuid": "07481165-CBFA-1957-F86F-E5C95EAF293E",
    "name": "Behind the Scenes at WorldSkills",
    "url": "https://uploads.video-commander.com/sample/BigBuckBunny.mp4",
    "length": 596000
  },
  {
    "uuid": "18592276-DC0B-2A68-A970-F6DA6FB03A4F",
    "name": "Interview with a Competitor",
    "url": "https://uploads.video-commander.com/sample/BigBuckBunny.mp4",
    "length": 596000
  },
  {
    "uuid": "296A3387-ED1C-3B79-BA81-07EB70C14B50",
    "name": "Learning New Digital Skills",
    "url": "https://uploads.video-commander.com/sample/BigBuckBunny.mp4",
    "length": 596000
  },
  {
    "uuid": "3A7B4498-FE2D-4C8A-CB92-18FC81D25C61",
    "name": "Future of Web Development",
    "url": "https://uploads.video-commander.com/sample/BigBuckBunny.mp4",
    "length": 596000
  },
  {
    "uuid": "4B8C55A9-0F3E-5D9B-DCA3-290D92E36D72",
    "name": "Young Professionals at WorldSkills",
    "url": "https://uploads.video-commander.com/sample/BigBuckBunny.mp4",
    "length": 596000
  },
  {
    "uuid": "5C9D66BA-104F-6EAC-EDB4-3A1EA3F47E83",
    "name": "WorldSkills Closing Ceremony",
    "url": "https://uploads.video-commander.com/sample/BigBuckBunny.mp4",
    "length": 596000
  },
  {
    "uuid": "6DAE77CB-2150-7FBD-FEC5-4B2FB4058F94",
    "name": "Thank You for Watching WorldSkills",
    "url": "https://uploads.video-commander.com/sample/BigBuckBunny.mp4",
    "length": 596000
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
    "uuid": "1a4b3c2d-7e8f-4a91-b234-56789abcdef0",
    "ipAddress": "127.0.0.1",
    "commentText": "Great video!",
    "commentTime": 1653292874166,
    "videoUUID": "3A7B44F8-BE2D-4CFA-8BF2-129C81D2BC61"
  },
  {
    "uuid": "2b5c4d3e-8f90-4b12-c345-6789abcdef01",
    "ipAddress": "127.0.0.2",
    "commentText": "Thanks for sharing this video.",
    "commentTime": 1653292875166,
    "videoUUID": "4B8C55A9-CF3E-5DFB-9CA3-230D92E3CD72"
  },
  {
    "uuid": "3c6d5e4f-9012-4c23-d456-789abcdef012",
    "ipAddress": "192.168.1.10",
    "commentText": "This video is very interesting.",
    "commentTime": 1653292876166,
    "videoUUID": "5C9D66BA-D04F-6EAC-ADB4-341EA3F4DE83"
  },
  {
    "uuid": "4d7e6f50-a123-4d34-e567-89abcdef0123",
    "ipAddress": "192.168.1.11",
    "commentText": "I really enjoyed watching this.",
    "commentTime": 1653292877166,
    "videoUUID": "6DAE77CB-E150-7FBD-BEC5-452FB405EF94"
  },
  {
    "uuid": "5e8f7061-b234-4e45-f678-9abcdef01234",
    "ipAddress": "192.168.1.12",
    "commentText": "Nice work!",
    "commentTime": 1653292878166,
    "videoUUID": "7EBF88DC-F261-80CE-CFD6-5630C516F0A5"
  },
  {
    "uuid": "6f907172-c345-4f56-a789-abcdef012345",
    "ipAddress": "10.0.0.1",
    "commentText": "Looking forward to the next video.",
    "commentTime": 1653292879166,
    "videoUUID": "8FC099ED-A372-91DF-D0E7-6741D627A1B6"
  },
  {
    "uuid": "70918283-d456-4067-b890-bcdef0123456",
    "ipAddress": "10.0.0.2",
    "commentText": "Very useful information.",
    "commentTime": 1653292880166,
    "videoUUID": "90D1AAFE-B483-A2E0-E1F8-7852E738B2C7"
  },
  {
    "uuid": "81a29394-e567-4178-c901-cdef01234567",
    "ipAddress": "10.0.0.3",
    "commentText": "I learned a lot from this video.",
    "commentTime": 1653292881166,
    "videoUUID": "A1E2BB0F-C594-B3F1-F209-8963F849C3D8"
  },
  {
    "uuid": "92b3a4a5-f678-4289-d012-def012345678",
    "ipAddress": "172.16.0.10",
    "commentText": "Amazing content.",
    "commentTime": 1653292882166,
    "videoUUID": "B2F3CC10-D6A5-C402-A31A-9074095AD4E9"
  },
  {
    "uuid": "a3c4b5b6-0789-439a-e123-ef0123456789",
    "ipAddress": "172.16.0.11",
    "commentText": "Please make more videos like this.",
    "commentTime": 1653292883166,
    "videoUUID": "C304DD21-E7B6-D513-B42B-A1851A6BE5FA"
  },
  {
    "uuid": "b4d5c6c7-189a-44ab-f234-f01234567890",
    "ipAddress": "172.16.0.12",
    "commentText": "This is one of my favorite videos.",
    "commentTime": 1653292884166,
    "videoUUID": "D415EE32-F8C7-E624-C53C-B2962B7CF60B"
  },
  {
    "uuid": "c5e6d7d8-29ab-45bc-a345-012345678901",
    "ipAddress": "192.168.0.20",
    "commentText": "Good explanation.",
    "commentTime": 1653292885166,
    "videoUUID": "E526FF43-A9D8-F735-D64D-C3A73C8D071C"
  },
  {
    "uuid": "d6f7e8e9-3abc-46cd-b456-123456789012",
    "ipAddress": "192.168.0.21",
    "commentText": "The quality is excellent.",
    "commentTime": 1653292886166,
    "videoUUID": "F6370054-BAE9-0846-E75E-D4B84D9E182D"
  },
  {
    "uuid": "e708f9fa-4bcd-47de-c567-234567890123",
    "ipAddress": "192.168.0.22",
    "commentText": "Very clear and easy to understand.",
    "commentTime": 1653292887166,
    "videoUUID": "07481165-CBFA-1957-F86F-E5C95EAF293E"
  },
  {
    "uuid": "f8190a0b-5cde-48ef-d678-345678901234",
    "ipAddress": "127.0.0.3",
    "commentText": "Thanks for the helpful content.",
    "commentTime": 1653292888166,
    "videoUUID": "18592276-DC0B-2A68-A970-F6DA6FB03A4F"
  },
  {
    "uuid": "092a1b1c-6def-4901-e789-456789012345",
    "ipAddress": "127.0.0.4",
    "commentText": "I will share this with my friends.",
    "commentTime": 1653292889166,
    "videoUUID": "296A3387-ED1C-3B79-BA81-07EB70C14B50"
  },
  {
    "uuid": "1a3b2c2d-7ef0-4a12-f890-567890123456",
    "ipAddress": "192.168.2.30",
    "commentText": "Awesome video!",
    "commentTime": 1653292890166,
    "videoUUID": "3A7B4498-FE2D-4C8A-CB92-18FC81D25C61"
  },
  {
    "uuid": "2b4c3d3e-8f01-4b23-a901-678901234567",
    "ipAddress": "192.168.2.31",
    "commentText": "Keep up the good work.",
    "commentTime": 1653292891166,
    "videoUUID": "4B8C55A9-0F3E-5D9B-DCA3-290D92E36D72"
  },
  {
    "uuid": "3c5d4e4f-9012-4c34-b012-789012345678",
    "ipAddress": "192.168.2.32",
    "commentText": "This helped me understand the topic.",
    "commentTime": 1653292892166,
    "videoUUID": "5C9D66BA-104F-6EAC-EDB4-3A1EA3F47E83"
  },
  {
    "uuid": "4d6e5f50-a123-4d45-c123-890123456789",
    "ipAddress": "192.168.2.33",
    "commentText": "Waiting for your next upload.",
    "commentTime": 1653292893166,
    "videoUUID": "6DAE77CB-2150-7FBD-FEC5-4B2FB4058F94"
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
                elif str(page_number) == '1':
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
                elif str(page_number) == '2':
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
                elif str(page_number) == '3':
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
                elif str(page_number) == '4':
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
                elif str(page_number) == '5':
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
                elif str(page_number) == '6':
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
                        "totalPhotos": 54,
                        "totalPage": 6
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