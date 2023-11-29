import Head from 'next/head'
import { Button, Container, Form, Spinner, Stack } from "react-bootstrap";
import React from "react";
import { ChevronRight } from "react-bootstrap-icons";

export default function Home() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [title, setTitle] = React.useState("");
  const [categories, setCategories] = React.useState<string[]>([]);
  const [abstract, setAbstract] = React.useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    } else {
      setFile(null); // Reset if no file is selected
    }
  };

  const handleSubmit = React.useCallback(async () => {
    if (!file) {
      setStatus("No file selected.");
      return;
    }
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch('/api/processing', {
        method: 'post',
        body: formData,
      });
      const responseData = await res.json();
      const result = responseData.result
      setTitle(result.title ?? "Sorry, an error occured. Please try again.");
      setCategories(result.categories ?? ["Sorry, an error occured. Please try again."]);
      setAbstract(result.abstract ?? "Sorry, an error occured. Please try again.");
      setStatus("success");
    } catch (err) {
      setTitle("Sorry, an error occured. Please try again.");
      setCategories(["Sorry an error occured. Please try again."]);
      setAbstract("Sorry, an error occured. Please try again.");
      setStatus("Sorry, an error occured. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [file]);

  return (
    <>
      <Head>
        <title>🧙 WarcBuddy</title>
        <meta name="description" content="Helps label and summarise .sg web archives"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <link rel="icon" href="/favicon.ico"/>
      </Head>
      <main>
        <Container style={{ height: '100vh' }}>
          <Stack gap={5} className="align-content-center py-5">
            <Stack style={{ alignItems: 'center' }}>
              <pre style={{ fontSize: 72 }}>🧙</pre>
              <h1>WarcBuddy</h1>
              <h6>Helps you categorise and summarise .sg web archives</h6>
            </Stack>
            <Stack>
            <Form.Group controlId="fileUpload" className="mb-3">
              <Form.Label>Upload WARC File</Form.Label>
              <Form.Control 
                type="file" 
                onChange={handleFileChange}
                accept=".gz" // Only accept gz files
              />
            </Form.Group>
              <Button
                variant="primary"
                disabled={isLoading || !file}
                onClick={handleSubmit}
              >
                {isLoading ? <>Let the Magic Happen <Spinner size="sm"/></> : <>Let the Magic Happen <ChevronRight/></>}
              </Button>
            </Stack>
            <Stack gap={3}>
              <Form.Group>
                <Form.Label>Title</Form.Label>
                <Form.Control
                  as="textarea"
                  value={title}
                  readOnly
                  disabled
                  style={{ minHeight: '50px' }}
                />
              </Form.Group>

              <Form.Group>
                <Form.Label>Categories</Form.Label>
                <Form.Control
                  as="textarea"
                  value={categories.join('\n')} // Join categories with newline
                  readOnly
                  disabled
                  style={{ minHeight: '100px' }}
                />
              </Form.Group>

              <Form.Group>
                <Form.Label>Abstract</Form.Label>
                <Form.Control
                  as="textarea"
                  value={abstract}
                  readOnly
                  disabled
                  style={{ minHeight: '150px' }}
                />
              </Form.Group>
          </Stack>
          </Stack>
        </Container>
      </main>
    </>
  )
}
